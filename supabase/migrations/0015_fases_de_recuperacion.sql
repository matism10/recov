-- Recov · 0015 · Fases de recuperación
-- Ejecutar DESPUÉS de 0014 (en una consulta aparte). No cambia enums.
--
-- * set_injury_phases:   kinesiólogo (o delegado) y head coach definen la lista de fases de una
--                        lesión activa (la app parte de una plantilla editable).
-- * advance_injury_phase: completa la fase en curso e inicia la siguiente.
-- * Al quedar en curso una fase llamada "Reintegro", el jugador pasa a disponibilidad "reintegro".
-- * El jugador ve las fases de sus propias lesiones (política nueva de lectura).
-- * squad_current_phases: de sus compañeros, el jugador solo ve el nombre de la fase en curso;
--   nunca el tipo de lesión, fechas ni documentos.
-- * Nada se borra: una fase quitada se marca con archived_at y deja de mostrarse.

-- ---------------------------------------------------------------------
-- Fases quitadas: se conservan marcadas
-- ---------------------------------------------------------------------
alter table public.injury_phases add column archived_at timestamptz;

-- ---------------------------------------------------------------------
-- Lectura: el jugador ve las fases de sus propias lesiones
-- ---------------------------------------------------------------------
create policy phases_player_select on public.injury_phases
  for select to authenticated
  using (
    club_id = private.current_club_id()
    and exists (
      select 1 from public.injuries i
       where i.id = injury_phases.injury_id and i.club_id = injury_phases.club_id
         and i.player_id = private.current_player_id())
  );

-- ---------------------------------------------------------------------
-- Disponibilidad: si la fase en curso es "Reintegro", el jugador queda en reintegro
-- ---------------------------------------------------------------------
create or replace function private.sync_reintegro(p_injury_id uuid, p_club_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if exists (
    select 1 from public.injury_phases
     where injury_id = p_injury_id and club_id = p_club_id
       and archived_at is null
       and status = 'en_curso' and lower(trim(name)) = 'reintegro'
  ) then
    update public.players p set availability = 'reintegro'
      from public.injuries i
     where i.id = p_injury_id and i.club_id = p_club_id
       and p.id = i.player_id and p.club_id = p_club_id;
  end if;
end $$;

revoke all on function private.sync_reintegro(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- set_injury_phases: define la lista de fases de una lesión activa
-- p_phases: [{"id": "<uuid, si ya existe>", "name": "Reposo", "status": "en_curso",
--             "started_on": "2026-10-01", "ended_on": null}, ...]
--           en orden; 1 a 8 fases; a lo más una en curso; las completadas van antes que el resto.
-- Con id se actualiza la fase; sin id se crea; las fases actuales que no vienen se marcan
-- como quitadas (archived_at).
-- ---------------------------------------------------------------------
create or replace function public.set_injury_phases(p_injury_id uuid, p_phases jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  cid     uuid := private.current_club_id();
  inj     public.injuries%rowtype;
  f       jsonb;
  pos     int := 0;
  v_id    uuid;
  kept    uuid[] := '{}';
  v_name  text;
  v_status public.phase_status;
  v_start date;
  v_end   date;
  in_progress int := 0;
  seen_pending boolean := false;
begin
  if (select auth.uid()) is null or cid is null or not private.can_manage_injuries() then
    raise exception 'No tienes permiso para esta acción';
  end if;

  select * into inj from public.injuries where id = p_injury_id and club_id = cid;
  if not found then raise exception 'Lesión no encontrada'; end if;
  if inj.status <> 'activa' then raise exception 'Solo se pueden definir fases de una lesión activa'; end if;

  if p_phases is null or jsonb_typeof(p_phases) <> 'array'
     or jsonb_array_length(p_phases) < 1 or jsonb_array_length(p_phases) > 8 then
    raise exception 'Define entre 1 y 8 fases';
  end if;

  -- Validación completa antes de tocar nada.
  for f in select * from jsonb_array_elements(p_phases) loop
    v_name := trim(coalesce(f->>'name', ''));
    if char_length(v_name) < 2 or char_length(v_name) > 60 then
      raise exception 'Cada fase necesita un nombre (2 a 60 caracteres)';
    end if;
    begin
      v_id     := nullif(f->>'id', '')::uuid;
      v_status := coalesce(f->>'status', 'pendiente')::public.phase_status;
      v_start  := nullif(f->>'started_on', '')::date;
      v_end    := nullif(f->>'ended_on', '')::date;
    exception when others then
      raise exception 'Datos de fase inválidos';
    end;
    if v_id is not null then
      if v_id = any (kept) or not exists (
        select 1 from public.injury_phases
         where id = v_id and injury_id = p_injury_id and club_id = cid and archived_at is null
      ) then
        raise exception 'Fase no encontrada';
      end if;
      kept := kept || v_id;
    end if;
    if v_start is not null and v_start < inj.started_on then
      raise exception 'Una fase no puede empezar antes de la lesión';
    end if;
    if v_start is not null and v_end is not null and v_end < v_start then
      raise exception 'Una fase no puede terminar antes de empezar';
    end if;
    if v_status = 'en_curso' then in_progress := in_progress + 1; end if;
    if v_status = 'completada' and seen_pending then
      raise exception 'Las fases completadas deben ir antes que las pendientes';
    end if;
    if v_status <> 'completada' then seen_pending := true; end if;
  end loop;
  if in_progress > 1 then raise exception 'Solo puede haber una fase en curso'; end if;

  -- Las fases que no vienen en la lista se marcan como quitadas.
  update public.injury_phases set archived_at = now()
   where injury_id = p_injury_id and club_id = cid and archived_at is null
     and not (id = any (kept));

  for f in select * from jsonb_array_elements(p_phases) loop
    pos := pos + 1;
    v_id := nullif(f->>'id', '')::uuid;
    if v_id is not null then
      update public.injury_phases
         set name = trim(f->>'name'), position = pos,
             status = coalesce(f->>'status', 'pendiente')::public.phase_status,
             started_on = nullif(f->>'started_on', '')::date,
             ended_on = nullif(f->>'ended_on', '')::date
       where id = v_id;
    else
      insert into public.injury_phases (club_id, injury_id, name, position, status, started_on, ended_on)
      values (cid, p_injury_id, trim(f->>'name'), pos,
              coalesce(f->>'status', 'pendiente')::public.phase_status,
              nullif(f->>'started_on', '')::date, nullif(f->>'ended_on', '')::date);
    end if;
  end loop;

  perform private.sync_reintegro(p_injury_id, cid);
end $$;

-- ---------------------------------------------------------------------
-- advance_injury_phase: completa la fase en curso (hoy) e inicia la siguiente pendiente (hoy)
-- ---------------------------------------------------------------------
create or replace function public.advance_injury_phase(p_injury_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  cid  uuid := private.current_club_id();
  inj  public.injuries%rowtype;
  next_id uuid;
begin
  if (select auth.uid()) is null or cid is null or not private.can_manage_injuries() then
    raise exception 'No tienes permiso para esta acción';
  end if;

  select * into inj from public.injuries where id = p_injury_id and club_id = cid;
  if not found then raise exception 'Lesión no encontrada'; end if;
  if inj.status <> 'activa' then raise exception 'La lesión no está activa'; end if;

  select id into next_id from public.injury_phases
   where injury_id = p_injury_id and club_id = cid and archived_at is null and status = 'pendiente'
   order by position limit 1;

  if next_id is null and not exists (
    select 1 from public.injury_phases
     where injury_id = p_injury_id and club_id = cid and archived_at is null and status = 'en_curso'
  ) then
    raise exception 'No quedan fases por avanzar';
  end if;

  update public.injury_phases
     set status = 'completada', ended_on = current_date
   where injury_id = p_injury_id and club_id = cid and archived_at is null and status = 'en_curso';

  if next_id is not null then
    update public.injury_phases
       set status = 'en_curso', started_on = current_date
     where id = next_id;
  end if;

  perform private.sync_reintegro(p_injury_id, cid);
end $$;

-- ---------------------------------------------------------------------
-- squad_current_phases: fase en curso de cada jugador del plantel (solo el nombre)
-- ---------------------------------------------------------------------
create or replace function public.squad_current_phases()
returns table (player_id uuid, phase_name text)
language sql stable security definer set search_path = ''
as $$
  select i.player_id, ph.name
    from public.injury_phases ph
    join public.injuries i on i.id = ph.injury_id and i.club_id = ph.club_id
    join public.players p on p.id = i.player_id and p.club_id = i.club_id
   where ph.club_id = private.current_club_id()
     and i.status = 'activa'
     and ph.status = 'en_curso'
     and ph.archived_at is null
     and p.status = 'confirmado'
$$;

revoke all on function public.set_injury_phases(uuid, jsonb)   from public, anon, authenticated;
revoke all on function public.advance_injury_phase(uuid)        from public, anon, authenticated;
revoke all on function public.squad_current_phases()            from public, anon, authenticated;
grant execute on function public.set_injury_phases(uuid, jsonb) to authenticated;
grant execute on function public.advance_injury_phase(uuid)      to authenticated;
grant execute on function public.squad_current_phases()          to authenticated;

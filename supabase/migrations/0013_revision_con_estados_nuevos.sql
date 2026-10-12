-- Recov · 0013 · Funciones del ciclo de lesión con los estados nuevos
-- Ejecutar DESPUÉS de 0012 (en una consulta aparte).
--
-- * mark_player_injured: por defecto deja al jugador "en revisión" (antes en_recuperacion).
-- * review_injury: al confirmar, la disponibilidad sugerida es siempre "lesionado"
--   (antes dependía de la gravedad). El paso a "reintegro" se hace a mano.
-- El resto de ambas funciones queda igual que en 0010.

create or replace function public.mark_player_injured(
  p_player_id        uuid,
  p_occurred_during  text,
  p_note             text,
  p_availability     public.availability_status default 'en_revision',
  p_occurred_on      date default current_date
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  cid uuid := private.current_club_id();
  iid uuid;
begin
  if uid is null or cid is null or not private.can_manage_injuries() then
    raise exception 'No tienes permiso para esta acción';
  end if;

  p_note := trim(coalesce(p_note, ''));
  if char_length(p_note) < 2 or char_length(p_note) > 120 then
    raise exception 'Describe brevemente qué pasó (2 a 120 caracteres)';
  end if;
  if p_occurred_during is null or p_occurred_during not in ('entrenamiento', 'competencia') then
    raise exception 'Indica si fue en entrenamiento o competencia';
  end if;
  if p_availability is null then
    raise exception 'Disponibilidad inválida';
  end if;
  if p_occurred_on is null or p_occurred_on > current_date or p_occurred_on < current_date - 30 then
    raise exception 'Fecha inválida';
  end if;

  if not exists (
    select 1 from public.players where id = p_player_id and club_id = cid and status = 'confirmado'
  ) then
    raise exception 'Jugador no encontrado';
  end if;

  if exists (
    select 1 from public.injuries
     where player_id = p_player_id and club_id = cid and status = 'en_evaluacion'
  ) then
    raise exception 'Este jugador ya está en evaluación';
  end if;

  insert into public.injuries (club_id, player_id, type, severity, status, started_on, created_by,
                               reported_by_player, occurred_during)
  values (cid, p_player_id, p_note, null, 'en_evaluacion', p_occurred_on, uid, false, p_occurred_during)
  returning id into iid;

  update public.players set availability = p_availability where id = p_player_id and club_id = cid;

  return iid;
end $$;

create or replace function public.review_injury(
  p_injury_id          uuid,
  p_decision           text,
  p_severity           public.injury_severity default null,
  p_expected_return_on date default null,
  p_availability       public.availability_status default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  uid  uuid := (select auth.uid());
  cid  uuid := private.current_club_id();
  inj  public.injuries%rowtype;
  v_expected date;
begin
  if uid is null or cid is null or not private.can_manage_injuries() then
    raise exception 'No tienes permiso para esta acción';
  end if;
  if p_decision is null or p_decision not in ('confirmar', 'descartar', 'cerrar') then
    raise exception 'Decisión inválida';
  end if;

  select * into inj from public.injuries where id = p_injury_id and club_id = cid;
  if not found then raise exception 'Lesión no encontrada'; end if;

  if p_decision = 'confirmar' then
    if inj.status not in ('en_evaluacion', 'activa') then
      raise exception 'Esta lesión ya está cerrada o descartada';
    end if;
    if p_severity is null then raise exception 'Indica la gravedad'; end if;

    v_expected := coalesce(p_expected_return_on, inj.expected_return_on);
    if v_expected is null then raise exception 'Indica la fecha estimada de alta'; end if;
    if v_expected < inj.started_on then raise exception 'La fecha de alta no puede ser anterior a la lesión'; end if;

    update public.injuries
       set status = 'activa', severity = p_severity, expected_return_on = v_expected,
           reviewed_by = uid, reviewed_at = now()
     where id = p_injury_id;

    update public.players set availability = coalesce(p_availability, 'lesionado')
     where id = inj.player_id and club_id = cid;

  elsif p_decision = 'descartar' then
    if inj.status not in ('en_evaluacion', 'activa') then
      raise exception 'Esta lesión ya está cerrada o descartada';
    end if;

    update public.injuries
       set status = 'descartada', closed_on = current_date, reviewed_by = uid, reviewed_at = now()
     where id = p_injury_id;

    perform private.release_player_if_clear(inj.player_id, cid);

  else -- cerrar
    if inj.status <> 'activa' then
      raise exception 'Solo se puede dar de alta una lesión activa';
    end if;

    update public.injuries
       set status = 'cerrada', closed_on = current_date, reviewed_by = uid, reviewed_at = now()
     where id = p_injury_id;

    perform private.release_player_if_clear(inj.player_id, cid);
  end if;
end $$;

-- create or replace conserva los permisos; se repiten para dejarlos explícitos.
revoke all on function public.mark_player_injured(uuid, text, text, public.availability_status, date) from public, anon;
revoke all on function public.review_injury(uuid, text, public.injury_severity, date, public.availability_status) from public, anon;
grant execute on function public.mark_player_injured(uuid, text, text, public.availability_status, date) to authenticated;
grant execute on function public.review_injury(uuid, text, public.injury_severity, date, public.availability_status) to authenticated;

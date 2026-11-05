-- Recov · Plan de gimnasio: bloques, superseries e intensidad por tiempo.
--   · block: nombre del bloque del ejercicio (ej.: "Calentamiento"). Los ejercicios
--     seguidos con el mismo bloque se muestran juntos bajo ese título; null = sin bloque.
--   · superset: número de superserie dentro de la sesión (1–30). Los ejercicios seguidos
--     con el mismo número se hacen uno tras otro (A1, A2…); null = ejercicio suelto.
--   · intensity_type 'tiempo' con seconds (5 s a 60 min): ej. plancha 3 × 1 min, sin reps.
-- save_gym_plan y private.gym_session_exercises se reemplazan con la misma firma.

alter table public.gym_plan_exercises
  add column seconds  smallint check (seconds between 5 and 3600),
  add column block    text check (block is null or char_length(btrim(block)) between 1 and 40),
  add column superset smallint check (superset between 1 and 30);

-- 'tiempo' entra en los checks de intensidad (se reemplazan) y es el único sin reps.
alter table public.gym_plan_exercises alter column reps drop not null;
alter table public.gym_plan_exercises drop constraint gym_plan_exercises_intensity_type_check;
alter table public.gym_plan_exercises add constraint gym_plan_exercises_intensity_type_check
  check (intensity_type in ('pct', 'rpe', 'kg', 'bw', 'tiempo'));
alter table public.gym_plan_exercises drop constraint gym_plan_exercises_intensity_check;
alter table public.gym_plan_exercises add constraint gym_plan_exercises_intensity_check check (
  (intensity_type = 'pct' and pct is not null and test_id is not null and rpe is null and kg is null and seconds is null)
  or (intensity_type = 'rpe' and rpe is not null and pct is null and test_id is null and kg is null and seconds is null)
  or (intensity_type = 'kg' and kg is not null and pct is null and test_id is null and rpe is null and seconds is null)
  or (intensity_type = 'bw' and pct is null and test_id is null and rpe is null and kg is null and seconds is null)
  or (intensity_type = 'tiempo' and seconds is not null and pct is null and test_id is null and rpe is null and kg is null));
alter table public.gym_plan_exercises add constraint gym_plan_exercises_reps_required
  check (intensity_type = 'tiempo' or reps is not null);

-- Ejercicios vigentes de una sesión, con los kilos calculados para un jugador.
create or replace function private.gym_session_exercises(p_session uuid, p_player uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', e.id, 'sort', e.sort, 'name', e.name, 'sets', e.sets, 'reps', e.reps,
           'intensity_type', e.intensity_type, 'pct', e.pct, 'rpe', e.rpe, 'kg', e.kg,
           'seconds', e.seconds, 'block', e.block, 'superset', e.superset,
           'rest_seconds', e.rest_seconds, 'note', e.note,
           'test_id', e.test_id, 'test_name', td.name,
           'max', m.v,
           'calc_kg', case when e.intensity_type = 'pct' and m.v is not null
                           then private.gym_round_kg(m.v, e.pct) end)
           order by e.sort, e.name), '[]')
    from public.gym_plan_exercises e
    left join public.test_definitions td on td.id = e.test_id
    left join lateral (select private.gym_last_max(p_player, e.test_id) as v) m on e.test_id is not null
   where e.session_id = p_session and e.archived_at is null
$$;
revoke all on function private.gym_session_exercises(uuid, uuid) from public;

create or replace function public.save_gym_plan(p_plan jsonb)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_club    uuid := private.gym_planner_club();
  v_sport   text;
  v_id      uuid;
  v_status  text;
  v_name    text := btrim(coalesce(p_plan->>'name', ''));
  v_starts  date;
  v_ends    date;
  s         jsonb;
  e         jsonb;
  t         jsonb;
  x         text;
  v_sid     uuid;
  v_eid     uuid;
  v_ssort   int := 0;
  v_esort   int;
  v_keep_s  uuid[] := '{}';
  v_keep_e  uuid[] := '{}';
  v_type    text;
  v_block   text;
begin
  if jsonb_typeof(p_plan) is distinct from 'object' then raise exception 'Plan inválido'; end if;
  if char_length(v_name) not between 2 and 80 then
    raise exception 'El nombre debe tener entre 2 y 80 caracteres';
  end if;
  begin
    v_starts := (p_plan->>'starts_on')::date;
    v_ends := (p_plan->>'ends_on')::date;
  exception when others then
    raise exception 'Revisa las fechas de vigencia';
  end;
  if v_starts is null or v_ends is null then raise exception 'Elige la vigencia del plan'; end if;
  if v_ends < v_starts then raise exception 'La vigencia termina antes de empezar'; end if;
  if v_ends - v_starts > 366 then raise exception 'La vigencia no puede pasar de un año'; end if;
  if jsonb_typeof(coalesce(p_plan->'sessions', '[]')) <> 'array'
     or jsonb_array_length(coalesce(p_plan->'sessions', '[]')) > 14 then
    raise exception 'Revisa las sesiones del plan';
  end if;

  select c.sport into v_sport from public.clubs c where c.id = v_club;

  -- Plan
  v_id := nullif(p_plan->>'id', '')::uuid;
  if v_id is not null then
    select gp.status into v_status from public.gym_plans gp where gp.id = v_id and gp.club_id = v_club for update;
    if not found then raise exception 'not_found'; end if;
    if v_status = 'archivado' then raise exception 'El plan está archivado'; end if;
    update public.gym_plans
       set name = v_name, starts_on = v_starts, ends_on = v_ends, updated_at = now()
     where id = v_id;
  else
    insert into public.gym_plans (club_id, name, starts_on, ends_on, created_by)
    values (v_club, v_name, v_starts, v_ends, (select auth.uid()))
    returning id into v_id;
  end if;

  -- Sesiones y ejercicios
  for s in select value from jsonb_array_elements(coalesce(p_plan->'sessions', '[]')) loop
    v_ssort := v_ssort + 1;
    v_sid := nullif(s->>'id', '')::uuid;
    if v_sid is not null and not exists (
      select 1 from public.gym_plan_sessions gs where gs.id = v_sid and gs.plan_id = v_id) then
      v_sid := null;   -- id ajeno o de otro plan: se crea una sesión nueva
    end if;
    if char_length(btrim(coalesce(s->>'label', ''))) not between 1 and 40 then
      raise exception 'Cada sesión necesita un nombre (hasta 40 caracteres)';
    end if;
    if coalesce((s->>'weekday')::int, 0) not between 1 and 7 then
      raise exception 'Elige el día de cada sesión';
    end if;
    if coalesce((s->>'est_minutes')::int, 0) not between 10 and 240 then
      raise exception 'La duración de cada sesión va de 10 a 240 minutos';
    end if;
    if jsonb_typeof(coalesce(s->'exercises', '[]')) <> 'array'
       or jsonb_array_length(coalesce(s->'exercises', '[]')) > 30 then
      raise exception 'Revisa los ejercicios de la sesión';
    end if;

    if v_sid is null then
      insert into public.gym_plan_sessions (club_id, plan_id, label, weekday, est_minutes, sort)
      values (v_club, v_id, btrim(s->>'label'), (s->>'weekday')::smallint, (s->>'est_minutes')::smallint, v_ssort)
      returning id into v_sid;
    else
      update public.gym_plan_sessions
         set label = btrim(s->>'label'), weekday = (s->>'weekday')::smallint,
             est_minutes = (s->>'est_minutes')::smallint, sort = v_ssort, archived_at = null
       where id = v_sid;
    end if;
    v_keep_s := v_keep_s || v_sid;

    v_esort := 0;
    for e in select value from jsonb_array_elements(coalesce(s->'exercises', '[]')) loop
      v_esort := v_esort + 1;
      v_type := e->>'intensity_type';
      if char_length(btrim(coalesce(e->>'name', ''))) not between 2 and 60 then
        raise exception 'Cada ejercicio necesita un nombre de 2 a 60 caracteres';
      end if;
      if coalesce((e->>'sets')::int, 0) not between 1 and 10 then
        raise exception 'Las series van de 1 a 10 (%)', btrim(e->>'name');
      end if;
      if v_type is null or v_type not in ('pct', 'rpe', 'kg', 'bw', 'tiempo') then
        raise exception 'Elige la intensidad (%)', btrim(e->>'name');
      end if;
      if v_type <> 'tiempo' and char_length(btrim(coalesce(e->>'reps', ''))) not between 1 and 12 then
        raise exception 'Revisa las repeticiones (%)', btrim(e->>'name');
      end if;
      if v_type = 'tiempo' and coalesce((e->>'seconds')::int, 0) not between 5 and 3600 then
        raise exception 'El tiempo va de 5 segundos a 60 minutos (%)', btrim(e->>'name');
      end if;
      v_block := nullif(btrim(coalesce(e->>'block', '')), '');
      if char_length(v_block) > 40 then
        raise exception 'El nombre del bloque tiene hasta 40 caracteres (%)', v_block;
      end if;
      if nullif(e->>'superset', '') is not null and (e->>'superset')::int not between 1 and 30 then
        raise exception 'Revisa la superserie (%)', btrim(e->>'name');
      end if;
      if v_type = 'pct' and (coalesce((e->>'pct')::int, 0) not between 30 and 110
                             or not private.gym_kg_test(v_club, nullif(e->>'test_id', '')::uuid)) then
        raise exception 'Elige el porcentaje (30 a 110) y un test en kilos (%)', btrim(e->>'name');
      end if;
      if v_type = 'rpe' and coalesce((e->>'rpe')::int, 0) not between 1 and 10 then
        raise exception 'El esfuerzo va de 1 a 10 (%)', btrim(e->>'name');
      end if;
      if v_type = 'kg' and (coalesce((e->>'kg')::numeric, 0) <= 0 or (e->>'kg')::numeric >= 10000) then
        raise exception 'Revisa los kilos (%)', btrim(e->>'name');
      end if;
      if nullif(e->>'rest_seconds', '') is not null and (e->>'rest_seconds')::int not between 0 and 900 then
        raise exception 'El descanso va de 0 a 15 minutos (%)', btrim(e->>'name');
      end if;
      if char_length(coalesce(e->>'note', '')) > 140 then
        raise exception 'La nota tiene hasta 140 caracteres (%)', btrim(e->>'name');
      end if;

      v_eid := nullif(e->>'id', '')::uuid;
      if v_eid is not null and not exists (
        select 1 from public.gym_plan_exercises ge
          join public.gym_plan_sessions gs on gs.id = ge.session_id
         where ge.id = v_eid and gs.plan_id = v_id) then
        v_eid := null;
      end if;

      if v_eid is null then
        insert into public.gym_plan_exercises
          (club_id, session_id, sort, name, sets, reps, intensity_type, pct, test_id, rpe, kg, rest_seconds, note,
           seconds, block, superset)
        values (v_club, v_sid, v_esort, btrim(e->>'name'), (e->>'sets')::smallint,
                case when v_type <> 'tiempo' then btrim(e->>'reps') end, v_type,
                case when v_type = 'pct' then (e->>'pct')::smallint end,
                case when v_type = 'pct' then (e->>'test_id')::uuid end,
                case when v_type = 'rpe' then (e->>'rpe')::smallint end,
                case when v_type = 'kg' then (e->>'kg')::numeric end,
                nullif(e->>'rest_seconds', '')::smallint,
                nullif(btrim(coalesce(e->>'note', '')), ''),
                case when v_type = 'tiempo' then (e->>'seconds')::smallint end,
                v_block, nullif(e->>'superset', '')::smallint)
        returning id into v_eid;
      else
        update public.gym_plan_exercises
           set session_id = v_sid, sort = v_esort, name = btrim(e->>'name'), sets = (e->>'sets')::smallint,
               reps = case when v_type <> 'tiempo' then btrim(e->>'reps') end, intensity_type = v_type,
               seconds = case when v_type = 'tiempo' then (e->>'seconds')::smallint end,
               block = v_block, superset = nullif(e->>'superset', '')::smallint,
               pct = case when v_type = 'pct' then (e->>'pct')::smallint end,
               test_id = case when v_type = 'pct' then (e->>'test_id')::uuid end,
               rpe = case when v_type = 'rpe' then (e->>'rpe')::smallint end,
               kg = case when v_type = 'kg' then (e->>'kg')::numeric end,
               rest_seconds = nullif(e->>'rest_seconds', '')::smallint,
               note = nullif(btrim(coalesce(e->>'note', '')), ''),
               archived_at = null
         where id = v_eid;
      end if;
      v_keep_e := v_keep_e || v_eid;
    end loop;
  end loop;

  -- Lo que ya no está en el plan se archiva (no se borra).
  update public.gym_plan_sessions set archived_at = now()
   where plan_id = v_id and archived_at is null and not (id = any (v_keep_s));
  update public.gym_plan_exercises ge set archived_at = now()
    from public.gym_plan_sessions gs
   where gs.id = ge.session_id and gs.plan_id = v_id and ge.archived_at is null and not (ge.id = any (v_keep_e));

  -- Destinatarios y exclusiones: se reemplazan completos.
  update public.gym_plan_targets set archived_at = now() where plan_id = v_id and archived_at is null;
  for t in select value from jsonb_array_elements(coalesce(p_plan->'targets', '[]')) loop
    case t->>'kind'
      when 'plantel' then
        insert into public.gym_plan_targets (club_id, plan_id, kind) values (v_club, v_id, 'plantel');
      when 'sevens' then
        if not exists (select 1 from public.clubs c where c.id = v_club and c.has_sevens) then
          raise exception 'El plantel no tiene Sevens';
        end if;
        insert into public.gym_plan_targets (club_id, plan_id, kind) values (v_club, v_id, 'sevens');
      when 'posicion' then
        if not exists (select 1 from public.positions pos
                        where pos.id = nullif(t->>'position_id', '')::uuid and pos.sport = v_sport and pos.format = '15') then
          raise exception 'Posición inválida';
        end if;
        insert into public.gym_plan_targets (club_id, plan_id, kind, position_id)
        values (v_club, v_id, 'posicion', (t->>'position_id')::uuid);
      when 'jugador' then
        if not exists (select 1 from public.players p
                        where p.id = nullif(t->>'player_id', '')::uuid and p.club_id = v_club) then
          raise exception 'Jugador inválido';
        end if;
        insert into public.gym_plan_targets (club_id, plan_id, kind, player_id)
        values (v_club, v_id, 'jugador', (t->>'player_id')::uuid);
      else
        raise exception 'Destinatario inválido';
    end case;
  end loop;

  update public.gym_plan_exclusions set archived_at = now() where plan_id = v_id and archived_at is null;
  for x in select value from jsonb_array_elements_text(coalesce(p_plan->'exclusions', '[]')) loop
    if not exists (select 1 from public.players p where p.id = nullif(x, '')::uuid and p.club_id = v_club) then
      raise exception 'Jugador inválido';
    end if;
    insert into public.gym_plan_exclusions (club_id, plan_id, player_id) values (v_club, v_id, x::uuid);
  end loop;

  return v_id;
end $$;
revoke all on function public.save_gym_plan(jsonb) from public, anon;
grant execute on function public.save_gym_plan(jsonb) to authenticated;

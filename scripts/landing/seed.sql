-- Recov · Semana demo para las capturas de la landing (plantel ficticio "Demo - Rugby", adulta).
-- Solo datos ficticios. Sin DELETE: solo agrega lo que falta, así que se puede correr varias veces.
-- Fechas relativas a la semana actual en Chile (de lunes a sábado):
--   · Entrenamientos: lunes 18:00 (ya terminado si se corre el lunes de noche o después),
--     martes y jueves 19:00. El gimnasio del miércoles sale del plan publicado.
--   · Partido del sábado 16:00 vs. "Club Ficticio Andes", con nómina por puestos (15 + 8).
-- Correr con el MCP de Supabase (execute_sql) antes de `scripts/capturas-landing.ts`.

begin;

do $$
declare
  c   constant uuid := 'ae9bea22-0873-4748-91c0-a46dd6228a43';
  uhc constant uuid := 'de000000-0000-0000-0000-000000000002';  -- hc.demo
  tz  constant text := 'America/Santiago';
  v_mon timestamp := date_trunc('week', (now() at time zone tz))::timestamp;
  v_ev  uuid;
  rw record;
begin
  if not exists (select 1 from public.clubs where id = c and slug = 'demo-rugby' and category = 'Adulta') then
    raise exception 'El club % no es Demo - Rugby (adulta): no se toca nada', c;
  end if;

  -- 1. Entrenamientos y partido de la semana ---------------------------------------------------
  for rw in select * from (values
      ('entrenamiento', interval '18 hours',          interval '19 hours 30 minutes', 'Cancha Colegio', null::text),
      ('entrenamiento', interval '1 day 19 hours',    interval '1 day 20 hours 30 minutes', 'Cancha Norte', null),
      ('entrenamiento', interval '3 days 19 hours',   interval '3 days 20 hours 30 minutes', 'Cancha Colegio', null),
      ('competencia',   interval '5 days 16 hours',   interval '5 days 18 hours', 'Cancha Municipal Demo', 'Club Ficticio Andes')
    ) v(t, s, e, loc, opp)
  loop
    if not exists (select 1 from public.events where club_id = c and cancelled_at is null
                     and starts_at = (v_mon + rw.s) at time zone tz) then
      insert into public.events (club_id, type, starts_at, ends_at, location, opponent, created_by, format)
      values (c, rw.t, (v_mon + rw.s) at time zone tz, (v_mon + rw.e) at time zone tz,
              rw.loc, rw.opp, uhc, '15');
    end if;
  end loop;

  -- 2. Nómina por puestos del partido del sábado (lesionados fuera) ----------------------------
  select id into v_ev from public.events
   where club_id = c and cancelled_at is null and opponent = 'Club Ficticio Andes'
     and starts_at = (v_mon + interval '5 days 16 hours') at time zone tz;
  insert into public.event_callups (club_id, event_id, player_id, created_by, slot)
  select c, v_ev, p.id, uhc, s.slot
    from (values (1,'Bastián Undurraga'),(2,'Benjamín Castro'),(3,'Gaspar Garrido'),(4,'Felipe Herrera'),
                 (5,'Emilio Gajardo'),(6,'Alonso Fuentealba'),(7,'Fernando Troncoso'),(8,'Raimundo Jara'),
                 (9,'Álvaro Aguirre'),(10,'Agustín Silva'),(11,'Francisco Rebolledo'),(12,'Simón Donoso'),
                 (13,'Santiago Moraga'),(14,'Francisco Zamorano'),(15,'Maximiliano Díaz'),
                 (16,'Matías Leiva'),(17,'Rodrigo Navarrete'),(18,'Octavio Palma'),(19,'Octavio Troncoso'),
                 (20,'Álvaro Durán'),(21,'Hernán Jara'),(22,'León Mardones'),(23,'Clemente Donoso')) s(slot, nombre)
    join public.players p on p.club_id = c and p.full_name = s.nombre and p.status = 'confirmado'
                         and p.availability = 'disponible'
   where v_ev is not null
     -- sin lesión abierta: si no, la nómina muestra "Convocaste a un jugador no disponible"
     and not exists (select 1 from public.injuries i where i.player_id = p.id and i.status in ('activa', 'en_evaluacion'))
     and not exists (select 1 from public.event_callups x where x.event_id = v_ev and x.player_id = p.id and x.removed_at is null)
     and not exists (select 1 from public.event_callups x where x.event_id = v_ev and x.slot = s.slot and x.removed_at is null);

  -- 3. Esfuerzo del entrenamiento del lunes (si ya terminó): ~80 % responde, de 4 a 9 -----------
  --    Martín Vega (jugador.demo) no responde: así tiene la carga por registrar en su Resumen.
  select id into v_ev from public.events
   where club_id = c and cancelled_at is null and type = 'entrenamiento'
     and starts_at = (v_mon + interval '18 hours') at time zone tz and ends_at < now();
  insert into public.session_rpe (event_id, player_id, club_id, rpe, absent, submitted_at)
  select v_ev, p.id, c, 4 + ('x' || substr(md5(p.id::text || 'rpe'), 1, 3))::bit(12)::int % 6, false, now()
    from public.players p
   where v_ev is not null and p.club_id = c and p.status = 'confirmado' and p.active
     and p.availability = 'disponible' and p.full_name <> 'Martín Vega'
     and ('x' || substr(md5(p.id::text || 'resp'), 1, 3))::bit(12)::int % 10 < 8
     and not exists (select 1 from public.session_rpe x where x.event_id = v_ev and x.player_id = p.id);

  -- 4. Martín Vega entrenó por su cuenta hoy en la mañana (para "Mi carga") --------------------
  insert into public.gym_session_logs (club_id, player_id, plan_session_id, performed_on, minutes, rpe, completed_all, note)
  select c, p.id, null, (now() at time zone tz)::date, 50, 6, true, 'Trote y movilidad'
    from public.players p
   where p.club_id = c and p.full_name = 'Martín Vega'
     and not exists (select 1 from public.gym_session_logs x where x.player_id = p.id and x.performed_on = (now() at time zone tz)::date);
end $$;

commit;

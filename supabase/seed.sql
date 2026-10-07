-- Recov · Datos de demo (ficticios)
-- 1) En Supabase: Authentication → Users → Add user → crea tu usuario (marca "Auto Confirm User").
-- 2) Cambia el correo de abajo por el tuyo y ejecuta este script en el SQL Editor.
-- Crea un club demo de rugby con link "club-demo", te deja como head coach y kinesiólogo
-- (ya confirmado) y carga 6 jugadores confirmados de ejemplo.
--
-- Si ya habías corrido una versión anterior de este seed, el club "club-demo" ya existe:
-- cambia el valor de mi_slug (por ejemplo a 'club-demo-2').

do $$
declare
  mi_correo text := 'TU_CORREO@ejemplo.cl';
  mi_slug   text := 'club-demo';
  uid uuid;
  cid uuid;
begin
  select id into uid from auth.users where email = mi_correo;
  if uid is null then
    raise exception 'No existe un usuario con el correo % en Authentication', mi_correo;
  end if;

  insert into public.clubs (name, sport, slug) values ('Club Demo', 'rugby', mi_slug) returning id into cid;

  insert into public.profiles (id, club_id, roles, full_name, status)
  values (uid, cid, '{head_coach,kinesiologo}', 'Usuario Demo', 'confirmado');

  insert into public.players (club_id, full_name, first_name, last_name, position, availability, status) values
    (cid, 'Jugador Uno',    'Jugador', 'Uno',    'Pilar',         'disponible',      'confirmado'),
    (cid, 'Jugador Dos',    'Jugador', 'Dos',    'Hooker',        'disponible',      'confirmado'),
    (cid, 'Jugador Tres',   'Jugador', 'Tres',   'Segunda línea', 'en_recuperacion', 'confirmado'),
    (cid, 'Jugador Cuatro', 'Jugador', 'Cuatro', 'Medio scrum',   'disponible',      'confirmado'),
    (cid, 'Jugador Cinco',  'Jugador', 'Cinco',  'Apertura',      'de_baja',         'confirmado'),
    (cid, 'Jugador Seis',   'Jugador', 'Seis',   'Centro',        'disponible',      'confirmado');
end $$;

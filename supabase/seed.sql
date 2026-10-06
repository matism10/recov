-- Recov · Datos de demo (ficticios)
-- 1) En Supabase: Authentication → Users → Add user → crea tu usuario (marca "Auto Confirm User").
-- 2) Cambia el correo de abajo por el tuyo y ejecuta este script en el SQL Editor.
-- Crea un club demo, te asocia con todos los roles y carga 6 jugadores de ejemplo.

do $$
declare
  mi_correo text := 'TU_CORREO@ejemplo.cl';
  uid uuid;
  cid uuid;
begin
  select id into uid from auth.users where email = mi_correo;
  if uid is null then
    raise exception 'No existe un usuario con el correo % en Authentication', mi_correo;
  end if;

  insert into public.clubs (name, sport) values ('Club Demo', 'rugby') returning id into cid;

  insert into public.profiles (id, club_id, roles, full_name)
  values (uid, cid, '{admin,kinesiologo,entrenador}', 'Usuario Demo');

  insert into public.players (club_id, full_name, position, availability) values
    (cid, 'Jugador Uno',    'Pilar',        'disponible'),
    (cid, 'Jugador Dos',    'Hooker',       'disponible'),
    (cid, 'Jugador Tres',   'Segunda línea','en_recuperacion'),
    (cid, 'Jugador Cuatro', 'Medio scrum',  'disponible'),
    (cid, 'Jugador Cinco',  'Apertura',     'de_baja'),
    (cid, 'Jugador Seis',   'Centro',       'disponible');
end $$;

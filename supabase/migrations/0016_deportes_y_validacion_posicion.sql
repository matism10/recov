-- 0016: deportes nuevos, posiciones y validación de posición por trigger

-- Guard: no borrar posiciones de hockey si alguien las usa
do $$
begin
  if exists (
    select 1
    from public.players p
    join public.clubs c on c.id = p.club_id
    where c.sport = 'hockey'
      and (p.position in ('Arquero','Defensa','Mediocampista','Delantero')
        or p.secondary_position in ('Arquero','Defensa','Mediocampista','Delantero'))
  ) then
    raise exception 'Hay jugadores de hockey con posiciones antiguas; abortando 0016';
  end if;
end $$;

-- Deportes
insert into public.sports (slug, name) values
  ('futbol','Fútbol'),
  ('futsal','Futsal'),
  ('handball','Handball'),
  ('voleibol','Vóleibol'),
  ('basquetbol','Básquetbol')
on conflict (slug) do nothing;

update public.sports set name = 'Hockey césped' where slug = 'hockey';

-- Rugby: Ala -> Flanker (catálogo y jugadores)
update public.positions set name = 'Flanker'
 where sport = 'rugby' and name = 'Ala';

update public.players p
   set position = case when p.position = 'Ala' then 'Flanker' else p.position end,
       secondary_position = case when p.secondary_position = 'Ala' then 'Flanker' else p.secondary_position end
  from public.clubs c
 where c.id = p.club_id and c.sport = 'rugby'
   and (p.position = 'Ala' or p.secondary_position = 'Ala');

-- Hockey: reemplazo del catálogo
delete from public.positions
 where sport = 'hockey'
   and name in ('Arquero','Defensa','Mediocampista','Delantero');

-- Posiciones nuevas
insert into public.positions (id, sport, name, sort)
select gen_random_uuid(), v.sport, v.name, v.sort
from (values
  ('futbol','Portero',1),
  ('futbol','Lateral',2),
  ('futbol','Defensa central',3),
  ('futbol','Mediocampista defensivo',4),
  ('futbol','Mediocampista central',5),
  ('futbol','Mediocampista ofensivo',6),
  ('futbol','Extremo',7),
  ('futbol','Delantero centro',8),
  ('futsal','Portero',1),
  ('futsal','Cierre',2),
  ('futsal','Ala',3),
  ('futsal','Pívot',4),
  ('handball','Portero',1),
  ('handball','Extremo',2),
  ('handball','Lateral',3),
  ('handball','Central',4),
  ('handball','Pivote',5),
  ('voleibol','Armador',1),
  ('voleibol','Central (bloqueador)',2),
  ('voleibol','Punta (receptor-atacante)',3),
  ('voleibol','Opuesto',4),
  ('voleibol','Líbero',5),
  ('basquetbol','Base',1),
  ('basquetbol','Escolta',2),
  ('basquetbol','Alero',3),
  ('basquetbol','Ala-pívot',4),
  ('basquetbol','Pívot',5),
  ('hockey','Portero',1),
  ('hockey','Defensa central',2),
  ('hockey','Defensa lateral',3),
  ('hockey','Mediocampista defensivo',4),
  ('hockey','Mediocampista central',5),
  ('hockey','Delantero',6),
  ('hockey','Extremo',7)
) as v(sport, name, sort);

-- Trigger: la posición del jugador debe existir en el catálogo del deporte de su club
create or replace function private.validate_player_position()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sport text;
begin
  select sport into v_sport from public.clubs where id = new.club_id;
  if v_sport is null then
    raise exception 'Club inexistente para el jugador';
  end if;

  if new.position is not null and not exists (
    select 1 from public.positions where sport = v_sport and name = new.position
  ) then
    raise exception 'Posición principal inválida para el deporte del club: %', new.position
      using errcode = '23514';
  end if;

  if new.secondary_position is not null and not exists (
    select 1 from public.positions where sport = v_sport and name = new.secondary_position
  ) then
    raise exception 'Posición secundaria inválida para el deporte del club: %', new.secondary_position
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_player_position() from public, anon, authenticated;

create trigger players_validate_position
  before insert or update of position, secondary_position, club_id
  on public.players
  for each row execute function private.validate_player_position();

-- Verificación final (aborta la migración si algo no cuadra)
do $$
begin
  if (select count(*) from public.sports) <> 7 then
    raise exception 'Se esperaban 7 deportes';
  end if;
  if (select count(*) from public.positions) <> 44 then
    raise exception 'Se esperaban 44 posiciones';
  end if;
  if exists (
    select 1
    from public.players p
    join public.clubs c on c.id = p.club_id
    where (p.position is not null and not exists
            (select 1 from public.positions x where x.sport = c.sport and x.name = p.position))
       or (p.secondary_position is not null and not exists
            (select 1 from public.positions x where x.sport = c.sport and x.name = p.secondary_position))
  ) then
    raise exception 'Hay jugadores con posición fuera del catálogo de su deporte';
  end if;
end $$;

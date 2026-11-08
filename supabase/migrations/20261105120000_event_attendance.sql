-- Asistencia a entrenamientos: el staff pasa lista y todos los confirmados ven el ranking.
-- Ajuste respecto del texto original: la lista de un entrenamiento Sevens (events.format = '7')
-- es solo el grupo Sevens activo, como la lista del plantel en la app (inFormat) y
-- team_match_load. En '15', todo el plantel confirmado y activo (getSquad).

create table public.event_attendance (
  event_id    uuid not null,
  player_id   uuid not null,
  club_id     uuid not null,
  present     boolean not null,
  recorded_by uuid not null references public.profiles(id),
  recorded_at timestamptz not null default now(),
  primary key (event_id, player_id),
  foreign key (event_id, club_id) references public.events(id, club_id) on delete cascade,
  foreign key (player_id, club_id) references public.players(id, club_id)
);
create index event_attendance_club_player_idx on public.event_attendance (club_id, player_id);
alter table public.event_attendance enable row level security;
revoke all on public.event_attendance from anon;

create policy event_attendance_select on public.event_attendance
  for select to authenticated
  using (private.is_confirmed_member(club_id)
         and (private.is_staff(club_id) or player_id = private.current_player_id(club_id)));

create or replace function public.set_event_attendance(p_event_id uuid, p_absent uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_club uuid := private.current_club_id();
  v_absent uuid[] := coalesce(p_absent, '{}');
  v_format text;
  v_roster uuid[];
begin
  if v_club is null or not private.is_staff(v_club) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform 1 from public.events e where e.id = p_event_id and e.club_id = v_club;
  if not found then raise exception 'not_found'; end if;
  perform 1 from public.events e
   where e.id = p_event_id and e.type = 'entrenamiento' and e.cancelled_at is null;
  if not found then raise exception 'Solo se pasa lista en entrenamientos no cancelados'; end if;
  perform 1 from public.events e where e.id = p_event_id and e.starts_at <= now();
  if not found then raise exception 'El entrenamiento todavía no empieza'; end if;
  select coalesce(e.format, '15') into v_format from public.events e where e.id = p_event_id;

  -- Lista del entrenamiento: plantel confirmado y activo; en Sevens, solo el grupo activo.
  v_roster := array(
    select p.id from public.players p
     where p.club_id = v_club and p.active and p.status = 'confirmado'
       and (v_format <> '7' or exists (
             select 1 from public.sevens_group g
              where g.club_id = v_club and g.member_id = p.user_id and g.archived_at is null)));

  if exists (
    select 1 from unnest(v_absent) u(id) where not (u.id = any (v_roster))
  ) then raise exception 'Jugador inválido'; end if;

  insert into public.event_attendance (event_id, player_id, club_id, present, recorded_by, recorded_at)
  select p_event_id, r.id, v_club, not (r.id = any (v_absent)), (select auth.uid()), now()
    from unnest(v_roster) r(id)
  on conflict (event_id, player_id) do update
    set present = excluded.present, recorded_by = excluded.recorded_by, recorded_at = excluded.recorded_at;
end $$;
revoke all on function public.set_event_attendance(uuid, uuid[]) from public, anon;
grant execute on function public.set_event_attendance(uuid, uuid[]) to authenticated;

create or replace function public.attendance_ranking(p_from date, p_to date)
returns table (player_id uuid, full_name text, attended int, total int)
language sql stable security definer set search_path = '' as $$
  select a.player_id, p.full_name,
         (count(*) filter (where a.present))::int, count(*)::int
    from public.event_attendance a
    join public.players p on p.id = a.player_id and p.club_id = a.club_id
    join public.events e  on e.id = a.event_id  and e.club_id = a.club_id
   where a.club_id = private.current_club_id()
     and private.is_confirmed_member(a.club_id)
     and p.active
     and e.cancelled_at is null
     and e.starts_at >= (p_from::timestamp at time zone 'America/Santiago')
     and e.starts_at <  ((p_to + 1)::timestamp at time zone 'America/Santiago')
   group by a.player_id, p.full_name
   order by (count(*) filter (where a.present))::numeric / count(*) desc,
            count(*) filter (where a.present) desc, p.full_name;
$$;
revoke all on function public.attendance_ranking(date, date) from public, anon;
grant execute on function public.attendance_ranking(date, date) to authenticated;

create or replace function private.dashboard_metric_keys()
returns text[] language sql immutable set search_path = '' as $$
  select array[
    'total','disponibles','lesionados','reintegro',
    'disponibilidad','lesiones_semana','lugar','posicion','recurrentes','proximas_altas',
    'asistencia'
  ]::text[]
$$;

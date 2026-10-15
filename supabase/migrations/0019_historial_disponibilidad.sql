-- 0019: historial de disponibilidad de jugadores.
-- Tabla de solo lectura para staff; la llena un trigger sobre players.availability.

create table public.availability_log (
  id          bigint generated always as identity primary key,
  club_id     uuid not null references public.clubs(id) on delete cascade,
  player_id   uuid not null references public.players(id) on delete cascade,
  from_status public.availability_status,          -- null = registro inicial
  to_status   public.availability_status not null,
  changed_at  timestamptz not null default now(),
  changed_by  uuid                                  -- auth.uid(); null si lo hizo postgres/seed
);

create index availability_log_club_time_idx   on public.availability_log (club_id, changed_at);
create index availability_log_player_time_idx on public.availability_log (player_id, changed_at desc);

-- Trigger: INSERT de jugador (fila inicial) y cambio real de availability.
create function private.log_availability_change()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if tg_op = 'INSERT' then
    insert into public.availability_log (club_id, player_id, from_status, to_status, changed_at, changed_by)
    values (new.club_id, new.id, null, new.availability, clock_timestamp(), (select auth.uid()));
  else
    insert into public.availability_log (club_id, player_id, from_status, to_status, changed_at, changed_by)
    values (new.club_id, new.id, old.availability, new.availability, clock_timestamp(), (select auth.uid()));
  end if;
  return null;
end $function$;

revoke all on function private.log_availability_change() from public, anon, authenticated;

create trigger players_log_availability_ins
  after insert on public.players
  for each row execute function private.log_availability_change();

create trigger players_log_availability_upd
  after update of availability on public.players
  for each row
  when (old.availability is distinct from new.availability)
  execute function private.log_availability_change();

-- RLS: lectura solo para staff del club; sin escritura para ningún rol de la app.
alter table public.availability_log enable row level security;

create policy availability_log_select on public.availability_log
  for select to authenticated
  using (club_id = private.current_club_id() and private.is_staff());

revoke all on table public.availability_log from anon, authenticated;
grant select on table public.availability_log to authenticated;

-- Backfill: una fila inicial por jugador existente, con su estado actual.
insert into public.availability_log (club_id, player_id, from_status, to_status, changed_at, changed_by)
select club_id, id, null, availability, now(), null
  from public.players;

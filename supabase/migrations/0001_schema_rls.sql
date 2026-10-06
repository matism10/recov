-- Recov · 0001 · Modelo de datos + aislamiento por club (RLS)
-- Principio: cada fila lleva club_id y la base de datos, no el frontend,
-- decide quién ve qué.

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type public.user_role as enum ('admin', 'kinesiologo', 'entrenador');
create type public.availability_status as enum ('disponible', 'en_recuperacion', 'de_baja');
create type public.injury_severity as enum ('leve', 'moderada', 'grave');
create type public.injury_status as enum ('activa', 'cerrada');
create type public.phase_status as enum ('pendiente', 'en_curso', 'completada');
create type public.document_status as enum ('borrador', 'revisado');

-- ---------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------
create table public.clubs (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  sport      text,
  created_at timestamptz not null default now()
);

-- Una persona puede tener más de un rol (club chico: head coach + admin).
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  club_id    uuid not null references public.clubs (id) on delete cascade,
  roles      public.user_role[] not null default '{}',
  full_name  text,
  created_at timestamptz not null default now()
);

create table public.players (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references public.clubs (id) on delete cascade,
  full_name    text not null,
  position     text,
  availability public.availability_status not null default 'disponible',
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (id, club_id)   -- habilita las FK compuestas de abajo
);

create table public.injuries (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null,
  player_id   uuid not null,
  type        text not null,
  severity    public.injury_severity not null,
  status      public.injury_status not null default 'activa',
  description text,
  started_on  date not null default current_date,
  closed_on   date,
  created_by  uuid references public.profiles (id),
  created_at  timestamptz not null default now(),
  unique (id, club_id),
  -- imposible asociar una lesión de un club a un jugador de otro
  foreign key (player_id, club_id) references public.players (id, club_id) on delete cascade
);

create table public.injury_phases (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null,
  injury_id  uuid not null,
  name       text not null,
  position   int  not null,
  status     public.phase_status not null default 'pendiente',
  started_on date,
  ended_on   date,
  created_at timestamptz not null default now(),
  foreign key (injury_id, club_id) references public.injuries (id, club_id) on delete cascade
);

create table public.documents (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null,
  player_id    uuid not null,
  injury_id    uuid,
  storage_path text not null,   -- {club_id}/{player_id}/{archivo}
  file_name    text not null,
  status       public.document_status not null default 'borrador',
  uploaded_by  uuid references public.profiles (id),
  reviewed_by  uuid references public.profiles (id),
  created_at   timestamptz not null default now(),
  foreign key (player_id, club_id) references public.players (id, club_id) on delete cascade,
  foreign key (injury_id, club_id) references public.injuries (id, club_id) on delete set null (injury_id)
);

create index on public.profiles      (club_id);
create index on public.players       (club_id);
create index on public.injuries      (club_id, player_id);
create index on public.injury_phases (club_id, injury_id);
create index on public.documents     (club_id, player_id);

-- ---------------------------------------------------------------------
-- Helpers (schema privado, no expuesto por la API)
-- ---------------------------------------------------------------------
create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.current_club_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select club_id from public.profiles where id = (select auth.uid())
$$;

create or replace function private.has_role(r public.user_role)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select r = any (roles) from public.profiles where id = (select auth.uid())),
    false
  )
$$;

revoke all on function private.current_club_id() from public, anon;
revoke all on function private.has_role(public.user_role) from public, anon;
grant execute on function private.current_club_id() to authenticated;
grant execute on function private.has_role(public.user_role) to authenticated;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.clubs         enable row level security;
alter table public.profiles      enable row level security;
alter table public.players       enable row level security;
alter table public.injuries      enable row level security;
alter table public.injury_phases enable row level security;
alter table public.documents     enable row level security;

revoke all on all tables in schema public from anon;

-- clubs: solo lectura del propio club (altas de club por service role)
create policy clubs_select on public.clubs
  for select to authenticated
  using (id = private.current_club_id());

-- profiles: todos ven al staff del club; solo admin gestiona.
-- Las altas de perfil se hacen con service role (invitación), no desde el cliente.
create policy profiles_select on public.profiles
  for select to authenticated
  using (club_id = private.current_club_id());

create policy profiles_update_admin on public.profiles
  for update to authenticated
  using      (club_id = private.current_club_id() and private.has_role('admin'))
  with check (club_id = private.current_club_id() and private.has_role('admin'));

-- players: todo el staff lee; admin y kinesiólogo escriben
create policy players_select on public.players
  for select to authenticated
  using (club_id = private.current_club_id());

create policy players_insert on public.players
  for insert to authenticated
  with check (club_id = private.current_club_id() and private.has_role('admin'));

create policy players_update on public.players
  for update to authenticated
  using      (club_id = private.current_club_id() and (private.has_role('admin') or private.has_role('kinesiologo')))
  with check (club_id = private.current_club_id() and (private.has_role('admin') or private.has_role('kinesiologo')));

create policy players_delete on public.players
  for delete to authenticated
  using (club_id = private.current_club_id() and private.has_role('admin'));

-- injuries + injury_phases: todo el staff lee; kinesiólogo escribe
create policy injuries_select on public.injuries
  for select to authenticated
  using (club_id = private.current_club_id());

create policy injuries_write on public.injuries
  for all to authenticated
  using      (club_id = private.current_club_id() and private.has_role('kinesiologo'))
  with check (club_id = private.current_club_id() and private.has_role('kinesiologo'));

create policy phases_select on public.injury_phases
  for select to authenticated
  using (club_id = private.current_club_id());

create policy phases_write on public.injury_phases
  for all to authenticated
  using      (club_id = private.current_club_id() and private.has_role('kinesiologo'))
  with check (club_id = private.current_club_id() and private.has_role('kinesiologo'));

-- documents: dato médico, solo kinesiólogo
create policy documents_all on public.documents
  for all to authenticated
  using      (club_id = private.current_club_id() and private.has_role('kinesiologo'))
  with check (club_id = private.current_club_id() and private.has_role('kinesiologo'));

-- ---------------------------------------------------------------------
-- Storage: bucket privado, primer segmento de la ruta = club_id
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('medical-docs', 'medical-docs', false)
on conflict (id) do nothing;

create policy medical_docs_kine on storage.objects
  for all to authenticated
  using (
    bucket_id = 'medical-docs'
    and (storage.foldername(name))[1] = private.current_club_id()::text
    and private.has_role('kinesiologo')
  )
  with check (
    bucket_id = 'medical-docs'
    and (storage.foldername(name))[1] = private.current_club_id()::text
    and private.has_role('kinesiologo')
  );

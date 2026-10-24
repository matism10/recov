create table public.club_members (
  user_id        uuid not null references public.profiles(id) on delete cascade,
  club_id        uuid not null references public.clubs(id),
  roles          public.user_role[] not null default '{}',
  status         public.member_status not null default 'pendiente',
  requested_role public.user_role,
  created_at     timestamptz not null default now(),
  primary key (user_id, club_id)
);

create index club_members_club_id_idx on public.club_members (club_id);

alter table public.club_members enable row level security;

create policy club_members_select_own on public.club_members
  for select to authenticated
  using (user_id = (select auth.uid()));

insert into public.club_members (user_id, club_id, roles, status, requested_role, created_at)
select id, club_id, roles, status, requested_role, created_at
from public.profiles;

create function private.sync_profile_to_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.club_members (user_id, club_id, roles, status, requested_role)
  values (new.id, new.club_id, new.roles, new.status, new.requested_role)
  on conflict (user_id, club_id) do update
    set roles = excluded.roles,
        status = excluded.status,
        requested_role = excluded.requested_role;
  return new;
end
$$;

revoke all on function private.sync_profile_to_member() from public;

create trigger profiles_sync_member
  after insert or update of club_id, roles, status, requested_role
  on public.profiles
  for each row execute function private.sync_profile_to_member();

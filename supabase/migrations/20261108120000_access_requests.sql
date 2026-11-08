-- Landing pública: solicitudes de acceso anticipado.
-- La tabla no tiene políticas: nadie la lee ni escribe directo; solo submit_access_request.
create table public.access_requests (
  id uuid primary key default gen_random_uuid(),
  club_name text not null check (char_length(club_name) between 2 and 120),
  sport text not null check (char_length(sport) between 2 and 40),
  role text not null check (char_length(role) between 2 and 60),
  full_name text not null check (char_length(full_name) between 2 and 120),
  email text not null check (char_length(email) between 5 and 254),
  status text not null default 'nuevo',
  created_at timestamptz not null default now()
);

alter table public.access_requests enable row level security;
revoke all on public.access_requests from anon, authenticated;

create index access_requests_email_created_idx on public.access_requests (lower(email), created_at desc);

create or replace function public.submit_access_request(
  p_club_name text,
  p_sport text,
  p_role text,
  p_full_name text,
  p_email text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club text := btrim(coalesce(p_club_name, ''));
  v_sport text := btrim(coalesce(p_sport, ''));
  v_role text := btrim(coalesce(p_role, ''));
  v_name text := btrim(coalesce(p_full_name, ''));
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if char_length(v_club) not between 2 and 120
     or char_length(v_sport) not between 2 and 40
     or char_length(v_role) not between 2 and 60
     or char_length(v_name) not between 2 and 120
     or char_length(v_email) > 254
     or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Datos inválidos' using errcode = '22023';
  end if;

  -- Mismo correo en 24 h: no se guarda otra vez, pero se responde ok.
  if exists (
    select 1 from public.access_requests
    where lower(email) = v_email and created_at > now() - interval '24 hours'
  ) then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;

  insert into public.access_requests (club_name, sport, role, full_name, email)
  values (v_club, v_sport, v_role, v_name, v_email);
  return jsonb_build_object('ok', true, 'duplicate', false);
end;
$$;

revoke all on function public.submit_access_request(text, text, text, text, text) from public;
grant execute on function public.submit_access_request(text, text, text, text, text) to anon, authenticated;

-- Recov · 0035 · Correo verificado antes de aprobar, y límite de correos de cuenta
-- 1. profiles.email_verified_at: se marca cuando la persona abre el link "Verifica
--    tu correo". Las cuentas que ya existían quedan verificadas (no se les pide
--    nada); las nuevas parten sin verificar.
-- 2. El token del link vive en private.email_verification_tokens, solo su hash.
--    Lo crea el servidor de la app (service_role) y se lo manda por correo a la
--    persona: ni ella ni nadie de la app puede pedirlo por la API.
-- 3. verify_email(token): la abre el link, con o sin sesión. Marca el correo como
--    verificado si el token existe, no venció (7 días) y no se usó. El token usado
--    se marca con used_at (no se borra).
-- 4. review_member no confirma a quien no verificó su correo (rechazar sí se puede).
-- 5. allow_auth_email: límite de correos de cuenta (verificación y recuperar
--    contraseña) por correo: 1 por minuto y 5 por hora. Solo service_role. Guarda
--    el hash del correo, no el correo. Esta tabla no lleva club_id: se usa antes de
--    saber a qué club pertenece (o si existe) la cuenta.

alter table public.profiles add column email_verified_at timestamptz;
update public.profiles set email_verified_at = created_at where email_verified_at is null;

create table private.email_verification_tokens (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  club_id uuid not null references public.clubs (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index email_verification_tokens_club_id_idx on private.email_verification_tokens (club_id);
alter table private.email_verification_tokens enable row level security;
revoke all on table private.email_verification_tokens from public, anon, authenticated;

create table private.auth_email_log (
  id bigint generated always as identity primary key,
  email_hash text not null,
  kind text not null check (kind in ('verificacion', 'recuperacion')),
  sent_at timestamptz not null default now()
);
create index auth_email_log_lookup_idx on private.auth_email_log (email_hash, kind, sent_at desc);
alter table private.auth_email_log enable row level security;
revoke all on table private.auth_email_log from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- create_email_verification: token nuevo (reemplaza al anterior) para un perfil
-- pendiente sin verificar. Devuelve el token en claro solo a service_role.
-- ---------------------------------------------------------------------
create or replace function public.create_email_verification(p_profile_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  select * into v_profile from public.profiles where id = p_profile_id;
  if not found then raise exception 'Perfil no encontrado'; end if;
  if v_profile.email_verified_at is not null then return null; end if;

  insert into private.email_verification_tokens (profile_id, club_id, token_hash, expires_at)
  values (p_profile_id, v_profile.club_id, encode(extensions.digest(v_token, 'sha256'), 'hex'), now() + interval '7 days')
  on conflict (profile_id) do update
    set token_hash = excluded.token_hash, expires_at = excluded.expires_at, used_at = null, created_at = now();
  return v_token;
end $$;

revoke all on function public.create_email_verification(uuid) from public, anon, authenticated;
grant execute on function public.create_email_verification(uuid) to service_role;

-- ---------------------------------------------------------------------
-- verify_email: true si el token es válido (y marca el correo); si no, false.
-- ---------------------------------------------------------------------
create or replace function public.verify_email(p_token text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile uuid;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then return false; end if;

  update private.email_verification_tokens
     set used_at = now()
   where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
     and used_at is null
     and expires_at > now()
  returning profile_id into v_profile;
  if v_profile is null then return false; end if;

  update public.profiles set email_verified_at = coalesce(email_verified_at, now()) where id = v_profile;
  return true;
end $$;

revoke all on function public.verify_email(text) from public;
grant execute on function public.verify_email(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- allow_auth_email: true (y lo anota) si se puede enviar otro correo de ese tipo.
-- ---------------------------------------------------------------------
create or replace function public.allow_auth_email(p_email text, p_kind text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash text := encode(extensions.digest(lower(btrim(coalesce(p_email, ''))), 'sha256'), 'hex');
begin
  if p_kind not in ('verificacion', 'recuperacion') then raise exception 'Tipo inválido'; end if;
  if exists (select 1 from private.auth_email_log
              where email_hash = v_hash and kind = p_kind and sent_at > now() - interval '1 minute')
     or (select count(*) from private.auth_email_log
          where email_hash = v_hash and kind = p_kind and sent_at > now() - interval '1 hour') >= 5 then
    return false;
  end if;
  insert into private.auth_email_log (email_hash, kind) values (v_hash, p_kind);
  return true;
end $$;

revoke all on function public.allow_auth_email(text, text) from public, anon, authenticated;
grant execute on function public.allow_auth_email(text, text) to service_role;

-- ---------------------------------------------------------------------
-- review_member: igual que antes, más el requisito de correo verificado al confirmar.
-- ---------------------------------------------------------------------
create or replace function public.review_member(p_profile_id uuid, p_decision text, p_roles public.user_role[] default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club   uuid := private.current_club_id();
  v_target public.profiles%rowtype;
  v_roles  public.user_role[];
  v_status public.member_status;
begin
  if not private.is_direction() then raise exception 'No tienes permiso para esta acción'; end if;
  if p_profile_id = (select auth.uid()) then raise exception 'No puedes modificar tu propio perfil'; end if;
  if p_decision not in ('confirmar', 'rechazar') then raise exception 'Decisión inválida'; end if;

  select * into v_target from public.profiles where id = p_profile_id and club_id = v_club;
  if not found then raise exception 'Perfil no encontrado'; end if;
  if v_target.status <> 'pendiente' then raise exception 'Este perfil ya fue revisado'; end if;
  if p_decision = 'confirmar' and v_target.email_verified_at is null then
    raise exception 'Esta persona aún no verifica su correo';
  end if;

  v_status := case when p_decision = 'confirmar' then 'confirmado' else 'rechazado' end::public.member_status;

  if exists (select 1 from public.players where user_id = p_profile_id) then
    update public.players  set status = v_status where user_id = p_profile_id;
    update public.profiles set status = v_status where id = p_profile_id;
  elsif p_decision = 'confirmar' then
    v_roles := coalesce(p_roles,
                        case when v_target.requested_role is null then null
                             else array[v_target.requested_role] end);
    if v_roles is null or cardinality(v_roles) = 0 or not (v_roles <@ private.staff_roles()) then
      raise exception 'Roles de staff inválidos';
    end if;
    update public.profiles set status = 'confirmado', roles = v_roles where id = p_profile_id;
  else
    update public.profiles set status = 'rechazado', roles = '{}' where id = p_profile_id;
  end if;
end $$;

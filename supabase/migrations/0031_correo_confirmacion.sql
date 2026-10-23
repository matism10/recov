-- Recov · 0031 · Correo "ya puedes entrar" al confirmar un registro
-- Cuando la dirección confirma a alguien (profiles.status pasa de 'pendiente' a
-- 'confirmado'), la base de datos llama a la Edge Function member-confirmed-email,
-- que busca el correo de la persona y lo envía por Resend. La app no ve ni maneja
-- correos de nadie, y no cambia ningún permiso.
-- - Una sola vez por persona: private.member_emails guarda a quién ya se le pidió.
-- - El llamado sale solo si la transacción se confirma (pg_net encola y envía
--   después del commit): una confirmación revertida no manda nada.
-- - Encendido y apagado: la URL de la función y el secreto compartido viven en
--   Vault ('member_email_hook_url' y 'member_email_hook_secret'). Sin ambos, no se
--   llama a nada y la confirmación sigue igual.

create extension if not exists pg_net;

create table private.member_emails (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  club_id uuid not null references public.clubs (id) on delete cascade,
  kind text not null default 'confirmado' check (kind in ('confirmado')),
  request_id bigint,
  queued_at timestamptz not null default now()
);

create index member_emails_club_id_idx on private.member_emails (club_id);

alter table private.member_emails enable row level security;
revoke all on table private.member_emails from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Trigger: encola el llamado a la Edge Function (nunca hace fallar la confirmación)
-- ---------------------------------------------------------------------
create or replace function private.queue_member_confirmed_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
  v_request bigint;
begin
  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'member_email_hook_url';
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'member_email_hook_secret';
  if v_url is null or v_secret is null then
    return new;  -- envío apagado
  end if;

  insert into private.member_emails (profile_id, club_id)
  values (new.id, new.club_id)
  on conflict (profile_id) do nothing;
  if not found then
    return new;  -- ya se pidió antes
  end if;

  begin
    select net.http_post(
      url := v_url,
      body := jsonb_build_object('profile_id', new.id),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-recov-hook-secret', v_secret
      ),
      timeout_milliseconds := 10000
    ) into v_request;
    update private.member_emails set request_id = v_request where profile_id = new.id;
  exception when others then
    -- Un problema al encolar el correo no debe impedir confirmar a la persona.
    raise warning 'member_emails: no se pudo encolar el correo de %: %', new.id, sqlerrm;
  end;
  return new;
end $$;

revoke all on function private.queue_member_confirmed_email() from public, anon, authenticated;

create trigger profiles_member_confirmed_email
after update of status on public.profiles
for each row
when (old.status = 'pendiente' and new.status = 'confirmado')
execute function private.queue_member_confirmed_email();

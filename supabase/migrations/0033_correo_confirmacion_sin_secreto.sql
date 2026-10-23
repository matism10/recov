-- Recov · 0033 · Correo de confirmación sin secreto compartido
-- En vez de un secreto entre la base y la Edge Function, la función "reclama" el
-- correo pendiente con claim_member_email: solo envía si la base lo encoló hace
-- menos de un día y nadie lo envió todavía, y lo marca como enviado en el mismo
-- paso. Así, aunque alguien llame a la función por su cuenta, no puede provocar
-- más correos que los que pidió una confirmación real.
-- - El trigger ahora solo necesita la URL en Vault ('member_email_hook_url').
-- - claim_member_email solo la ejecuta service_role (la Edge Function).

alter table private.member_emails add column sent_at timestamptz;

create or replace function private.queue_member_confirmed_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_request bigint;
begin
  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'member_email_hook_url';
  if v_url is null then
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
      headers := jsonb_build_object('Content-Type', 'application/json'),
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

-- ---------------------------------------------------------------------
-- claim_member_email: true (y lo marca enviado) si hay un correo pendiente
-- reciente para esa persona confirmada; si no, false.
-- ---------------------------------------------------------------------
create or replace function public.claim_member_email(p_profile_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claimed uuid;
begin
  update private.member_emails m
     set sent_at = now()
   where m.profile_id = p_profile_id
     and m.sent_at is null
     and m.queued_at > now() - interval '1 day'
     and exists (select 1 from public.profiles p
                  where p.id = m.profile_id and p.status = 'confirmado')
  returning m.profile_id into v_claimed;
  return v_claimed is not null;
end $$;

revoke all on function public.claim_member_email(uuid) from public, anon, authenticated;
grant execute on function public.claim_member_email(uuid) to service_role;

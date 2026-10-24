-- Recov · 0036 · Se quita la verificación de correo
-- La dirección vuelve a poder confirmar registros sin que la persona verifique su
-- correo (review_member queda como antes de 0035). Se mantiene el límite de correos
-- de recuperar contraseña (allow_auth_email).
-- Lo que dejó 0035 para verificar queda sin uso y sin acceso desde la app:
-- profiles.email_verified_at, private.email_verification_tokens,
-- create_email_verification (ya era solo service_role) y verify_email (se le quita
-- el permiso a anon y authenticated). No se borra nada.

revoke execute on function public.verify_email(text) from anon, authenticated;

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

-- Recov · 0041 · Multi-plantel (4 de 4, base de datos): plantel activo por header
-- La app enviará el header HTTP x-club-id con el plantel activo. private.active_club_id()
-- lo lee de request.headers (PostgREST) y lo valida contra las membresías de la cuenta.
-- Los helpers sin argumento pasan a ser envoltorios de sus versiones con club_id sobre
-- ese plantel, así las funciones públicas que los usan quedan listas sin tocarlas.
-- Sin header todo sigue igual: se usa el plantel principal (profiles.club_id).
-- Las políticas RLS no cambian: usan el club_id de cada fila, no el header.
-- Solo create or replace con la misma firma y el mismo tipo de retorno: se conservan
-- los permisos de ejecución. Una sola función nueva: private.active_club_id().

-- Plantel activo: header x-club-id validado contra las membresías de la cuenta.
-- Sin header: plantel principal (profiles.club_id). Header inválido o de un plantel donde
-- no es miembro: null (falla cerrado).
create function private.active_club_id()
returns uuid language sql stable security definer set search_path = ''
as $$
  with h as (
    select nullif(nullif(current_setting('request.headers', true), '')::json ->> 'x-club-id', '') as v
  )
  select case
    when h.v is null then (select club_id from public.profiles where id = (select auth.uid()))
    else (select m.club_id from public.club_members m
           where m.user_id = (select auth.uid()) and m.club_id = private.safe_uuid(h.v))
  end
  from h
$$;
-- Mismos permisos de ejecución que private.current_club_id(): postgres y authenticated.
revoke all on function private.active_club_id() from public;
grant execute on function private.active_club_id() to authenticated;

-- Mismo significado que antes (plantel confirmado / plantel con cualquier estado), pero sobre el plantel activo
create or replace function private.current_club_id()
returns uuid language sql stable security definer set search_path = ''
as $$ select c from (select private.active_club_id() as c) t where private.is_confirmed_member(c) $$;

create or replace function private.member_club_id()
returns uuid language sql stable security definer set search_path = ''
as $$ select private.active_club_id() $$;

create or replace function private.resolve_club(p_club uuid)
returns uuid language sql stable security definer set search_path = ''
as $$ select coalesce(p_club, private.active_club_id()) $$;

-- Helpers sin argumento: envoltorios de las versiones con club_id sobre el plantel activo
create or replace function private.has_role(r public.user_role)
returns boolean language sql stable security definer set search_path = ''
as $$ select private.has_role(private.current_club_id(), r) $$;

create or replace function private.is_staff()
returns boolean language sql stable security definer set search_path = ''
as $$ select private.is_staff(private.current_club_id()) $$;

create or replace function private.has_kine_powers()
returns boolean language sql stable security definer set search_path = ''
as $$ select private.has_kine_powers(private.current_club_id()) $$;

create or replace function private.can_manage_nominas()
returns boolean language sql stable security definer set search_path = ''
as $$ select private.can_manage_nominas(private.current_club_id()) $$;

-- current_player_id usa el plantel activo con cualquier estado (member_club_id), no solo
-- el confirmado: antes devolvía la ficha de la cuenta aunque estuviera pendiente o
-- rechazada, y así sigue igual sin header. Quienes lo usan (report_injury,
-- complete_injury_report) exigen además has_role('jugador'), que pide confirmación.
create or replace function private.current_player_id()
returns uuid language sql stable security definer set search_path = ''
as $$ select private.current_player_id(private.member_club_id()) $$;

-- set_my_phone: ahora actúa sobre la fila de jugador del plantel activo (antes tomaba cualquiera de la cuenta)
create or replace function public.set_my_phone(p_phone text)
returns void language plpgsql security definer set search_path to ''
as $function$
declare
  v_player uuid;
  v_club uuid;
  v_phone text := nullif(btrim(p_phone), '');
begin
  select id, club_id into v_player, v_club
    from public.players
   where user_id = (select auth.uid()) and club_id = private.member_club_id();
  if v_player is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_phone is null then
    delete from public.player_contacts where player_id = v_player;
    return;
  end if;

  if v_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'El teléfono debe tener formato internacional, por ejemplo +56912345678.';
  end if;

  insert into public.player_contacts (player_id, club_id, phone, updated_at)
  values (v_player, v_club, v_phone, now())
  on conflict (player_id) do update
    set phone = excluded.phone, club_id = excluded.club_id, updated_at = excluded.updated_at;
end;
$function$;

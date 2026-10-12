-- Recov · 0008 · El head coach también cambia la disponibilidad
-- Ejecutar DESPUÉS de 0007.
--
-- Pueden cambiar la disponibilidad: el kinesiólogo (o su delegado) y el head coach.
-- No se amplía players_update: el head coach no edita filas de players directo,
-- solo la disponibilidad, por la función de abajo.

-- Quién puede cambiar la disponibilidad. Un solo lugar para cambiar esta decisión.
create or replace function private.can_set_availability()
returns boolean language sql stable security definer set search_path = ''
as $$ select private.has_kine_powers() or private.has_role('head_coach') $$;

revoke all on function private.can_set_availability() from public, anon;
grant execute on function private.can_set_availability() to authenticated;

create or replace function public.set_player_availability(
  p_player_id    uuid,
  p_availability public.availability_status
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.can_set_availability() then raise exception 'No tienes permiso para esta acción'; end if;
  if p_availability is null then raise exception 'Estado de disponibilidad inválido'; end if;

  update public.players
     set availability = p_availability
   where id = p_player_id
     and club_id = private.current_club_id()
     and status = 'confirmado';
  if not found then raise exception 'Jugador no encontrado'; end if;
end $$;

revoke all on function public.set_player_availability(uuid, public.availability_status) from public, anon, authenticated;
grant execute on function public.set_player_availability(uuid, public.availability_status) to authenticated;

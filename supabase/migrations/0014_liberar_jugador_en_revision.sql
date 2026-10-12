-- Recov · 0014 · Disponibilidad al descartar o cerrar con otra lesión abierta
-- Ejecutar DESPUÉS de 0013 (en una consulta aparte).
--
-- Antes: si el jugador tenía otra lesión abierta, su disponibilidad no cambiaba. Si estaba
-- "en revisión" (lo marcaron lesionado y se descartó esa lesión), quedaba así sin poder
-- corregirse, porque la app no ofrece "en revisión" al cambiar la disponibilidad a mano.
--
-- Ahora, al descartar o cerrar:
--   * sin lesiones abiertas                         -> disponible (igual que antes)
--   * con lesiones abiertas, ninguna en evaluación,
--     y el jugador "en revisión"                    -> lesionado
--   * con otra lesión todavía en evaluación          -> sin cambios (sigue esperando el diagnóstico)

create or replace function private.release_player_if_clear(p_player_id uuid, p_club_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.injuries
     where player_id = p_player_id and club_id = p_club_id
       and status in ('activa', 'en_evaluacion')
  ) then
    update public.players set availability = 'disponible'
     where id = p_player_id and club_id = p_club_id;
  elsif not exists (
    select 1 from public.injuries
     where player_id = p_player_id and club_id = p_club_id
       and status = 'en_evaluacion'
  ) then
    update public.players set availability = 'lesionado'
     where id = p_player_id and club_id = p_club_id and availability = 'en_revision';
  end if;
end $$;

revoke all on function private.release_player_if_clear(uuid, uuid) from public, anon, authenticated;

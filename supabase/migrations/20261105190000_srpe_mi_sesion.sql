-- Recov · sRPE: una sesión del jugador autenticado, para la pantalla /reportar/[eventId].
-- Devuelve el evento, sus minutos (calculados como en private.session_minutes), la respuesta
-- guardada si la hay y si todavía se puede responder o corregir (private.rpe_check).
-- Solo datos propios: el jugador confirmado y activo del plantel activo.
create function public.my_session_report(p_event_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  v_club   uuid := private.current_club_id();
  v_player uuid;
  e        record;
  m        record;
  r        record;
  v_reason text;
begin
  if v_club is null then raise exception 'forbidden' using errcode = '42501'; end if;
  v_player := private.my_active_player(v_club);
  if v_player is null then raise exception 'forbidden' using errcode = '42501'; end if;

  select ev.id, ev.type, ev.starts_at, ev.ends_at, ev.opponent, ev.location, ev.format into e
    from public.events ev where ev.id = p_event_id and ev.club_id = v_club;
  if not found then raise exception 'not_found'; end if;

  select * into m from private.session_minutes(e.id, v_player);
  select sr.rpe, sr.absent, sr.submitted_at into r
    from public.session_rpe sr where sr.event_id = e.id and sr.player_id = v_player;
  v_reason := private.rpe_check(v_club, v_player, e.id);

  return jsonb_build_object(
    'event_id', e.id, 'type', e.type, 'starts_at', e.starts_at, 'ends_at', e.ends_at,
    'opponent', e.opponent, 'location', e.location, 'format', e.format,
    'minutes', m.minutes, 'estimated', m.estimated,
    'answered', r.submitted_at is not null, 'rpe', r.rpe, 'absent', coalesce(r.absent, false),
    'can_submit', v_reason is null, 'reason', v_reason);
end $$;
revoke all on function public.my_session_report(uuid) from public, anon;
grant execute on function public.my_session_report(uuid) to authenticated;

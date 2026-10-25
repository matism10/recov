-- Recov · 0042 · Ficha pública del plantel para el link /c/[slug]
-- El link muestra logo, nombre y categoría a quien todavía no tiene sesión.
-- club_public_info (nombre y deporte) queda igual; esta función agrega la categoría.
-- Mismos permisos que club_public_info: anon, authenticated y service_role.
-- Solo expone datos que ya se muestran en el link: nada de miembros ni de salud.
create function public.club_public_card(p_slug text)
returns table (name text, sport text, category text)
language sql stable security definer set search_path = ''
as $$
  select c.name, c.sport, c.category from public.clubs c where c.slug = lower(trim(p_slug))
$$;

revoke all on function public.club_public_card(text) from public;
grant execute on function public.club_public_card(text) to anon, authenticated, service_role;

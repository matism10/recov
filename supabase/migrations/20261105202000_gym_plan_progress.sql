-- Recov · Plan de gimnasio: avance por plan para la lista /planes (solo staff).
-- players: cuántos reciben el plan hoy (destinatarios menos exclusiones).
-- assigned / due / done: sesiones asignadas en su vigencia, las que ya tocaban (hasta
-- hoy) y las hechas, con la misma regla que gym_adherence (private.gym_assignments).
-- Los borradores no tienen sesiones asignadas (0).
create function public.gym_plan_progress()
returns table (plan_id uuid, players int, assigned int, due int, done int)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_club  uuid := private.current_club_id();
  v_today date := private.chile_today();
begin
  if v_club is null or not private.is_staff(v_club) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  select gp.id,
         (select count(*) from private.gym_plan_players(gp.id))::int,
         coalesce(a.assigned, 0), coalesce(a.due, 0), coalesce(a.done, 0)
    from public.gym_plans gp
    left join lateral (
      select count(*)::int as assigned,
             count(*) filter (where x.day <= v_today)::int as due,
             count(x.done_log_id)::int as done
        from private.gym_assignments(v_club, gp.starts_on, gp.ends_on) x
       where x.plan_id = gp.id) a on true
   where gp.club_id = v_club;
end $$;
revoke all on function public.gym_plan_progress() from public, anon;
grant execute on function public.gym_plan_progress() to authenticated;

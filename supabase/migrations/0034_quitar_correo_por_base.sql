-- Recov · 0034 · El correo de confirmación sale desde la app, no desde la base
-- El aviso "ya puedes entrar" ahora lo envía la acción de Registros (Next.js, en el
-- servidor) después de un review_member exitoso. Se quita la vía por base de datos
-- de 0031 y 0033: el trigger, su función y claim_member_email.
-- private.member_emails queda como está (sin uso). La extensión pg_net también.

drop trigger if exists profiles_member_confirmed_email on public.profiles;
drop function if exists private.queue_member_confirmed_email();
drop function if exists public.claim_member_email(uuid);

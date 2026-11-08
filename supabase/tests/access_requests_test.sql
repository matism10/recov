-- Solicitudes de acceso de la landing. Datos ficticios. Termina en ROLLBACK.
begin;
set local role anon;
do $$
declare r jsonb; n int;
begin
  r := public.submit_access_request('Club Demo Landing', 'Rugby', 'Entrenador/a o head coach', 'Persona Ficticia', 'Ficticia.Test@example.com');
  if (r->>'ok') <> 'true' or (r->>'duplicate') <> 'false' then raise exception 'FAIL: alta'; end if;
  r := public.submit_access_request('Club Demo Landing', 'Rugby', 'Otro', 'Persona Ficticia', 'ficticia.test@example.com');
  if (r->>'duplicate') <> 'true' then raise exception 'FAIL: duplicado 24h'; end if;
  begin
    perform public.submit_access_request('X', 'Rugby', 'Otro', 'Persona', 'a@b.cl');
    raise exception 'FAIL: club corto aceptado';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.submit_access_request('Club Demo', 'Rugby', 'Otro', 'Persona', 'sin-arroba');
    raise exception 'FAIL: correo inválido aceptado';
  exception when sqlstate '22023' then null; end;
  begin
    select count(*) into n from public.access_requests;
    raise exception 'FAIL: anon lee la tabla';
  exception when insufficient_privilege then null; end;
end $$;
rollback;

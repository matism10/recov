-- Recov · 0032 · pg_net solo para la base de datos
-- Al crear pg_net (0031), Supabase da a anon y authenticated permiso sobre el
-- esquema net: hacer llamados HTTP y leer la cola (que guarda el secreto del
-- correo). La app no lo necesita: el único que llama es el trigger del correo,
-- que corre con permisos propios (SECURITY DEFINER). Se quita ese acceso.

revoke usage on schema net from anon, authenticated;
revoke all on all tables in schema net from anon, authenticated;
revoke all on all functions in schema net from anon, authenticated;
revoke all on all sequences in schema net from anon, authenticated;

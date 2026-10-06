-- Recov · 0002 · Nuevo rol: jugador
-- IMPORTANTE: ejecutar SOLO este archivo, solo, y esperar el "Success".
-- Postgres no deja usar un valor de enum recién creado dentro de la misma
-- transacción, por eso las políticas que lo usan van en 0003.

alter type public.user_role add value if not exists 'jugador';

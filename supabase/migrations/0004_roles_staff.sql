-- Recov · 0004 · Nuevos roles del club
-- IMPORTANTE: ejecutar SOLO este archivo, en una consulta aparte, y esperar el "Success".
-- (Postgres no permite usar un valor de enum recién creado en la misma ejecución;
--  las políticas que los usan van en 0005.)
--
-- El rol "admin" se elimina: se renombra a "head_coach", así tu usuario actual lo conserva.

alter type public.user_role rename value 'admin' to 'head_coach';
alter type public.user_role add value if not exists 'manager';
alter type public.user_role add value if not exists 'nutricionista';
alter type public.user_role add value if not exists 'preparador_fisico';

-- Recov · 0012 · Estados de disponibilidad: Lesionado y Reintegro
-- Ejecutar SOLO este archivo, en una consulta aparte, e inmediatamente después 0013:
-- review_injury usa los nombres viejos y falla hasta que 0013 la reescribe.
--
-- Disponibilidad del jugador:
--   disponible   Disponible
--   en_revision  En revisión (solo al marcarlo lesionado, hasta que se revise la lesión)
--   lesionado    Lesionado   (antes de_baja)
--   reintegro    Reintegro   (antes en_recuperacion)
-- Se renombran los valores: los jugadores existentes conservan su estado con el nombre nuevo.

alter type public.availability_status rename value 'de_baja' to 'lesionado';
alter type public.availability_status rename value 'en_recuperacion' to 'reintegro';

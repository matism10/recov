-- Recov · 0027 · Modo de registro de la participación en partidos (enum)
-- Ejecutar DESPUÉS de 0026. Va sola: los cambios de enum van en su propia migración.
--
--   exacto: minutos jugados.
--   rango:  5 niveles (0 a 4) que dependen del deporte del club.
--   jugo:   jugó / no jugó.

create type public.nomina_mode as enum ('exacto', 'rango', 'jugo');

-- Recov · 0009 · Estados nuevos de la lesión
-- Ejecutar SOLO este archivo, en una consulta aparte (Postgres no permite usar un valor de enum
-- recién creado en la misma transacción; las funciones que lo usan van en 0010).
--
-- en_evaluacion: el kinesiólogo vio que el jugador se lesionó, pero aún no hay diagnóstico.
-- descartada:    resultó ser un golpe o molestia, sin lesión real.

alter type public.injury_status add value if not exists 'en_evaluacion';
alter type public.injury_status add value if not exists 'descartada';

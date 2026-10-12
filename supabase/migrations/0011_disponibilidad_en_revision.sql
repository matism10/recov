-- Recov · 0011 · Disponibilidad "en revisión"
-- Ejecutar SOLO este archivo, en una consulta aparte (Postgres no permite usar un valor de enum
-- recién creado en la misma transacción).
--
-- en_revision: el jugador fue marcado lesionado y espera la revisión del kinesiólogo.
-- La app lo usa al llamar a mark_player_injured; review_injury lo reemplaza al confirmar,
-- descartar o dar de alta.

alter type public.availability_status add value if not exists 'en_revision';

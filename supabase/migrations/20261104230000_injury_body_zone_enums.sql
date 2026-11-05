-- Registro de lesión v2 · enums de zona del cuerpo y lateralidad.
-- Van en una migración propia (regla: cambios de enum aparte). Los valores de
-- body_zone son también los identificadores de las regiones del mapa del cuerpo
-- en la app (src/lib/body-zones.ts).

create type public.body_zone as enum (
  'cabeza_cuello',
  'hombro',
  'biceps',
  'triceps',
  'codo',
  'antebrazo',
  'mano',
  'pecho',
  'espalda_alta',
  'lumbar',
  'abdomen',
  'cadera_ingle',
  'gluteo',
  'cuadriceps',
  'isquiotibial',
  'rodilla',
  'tibia',
  'gemelo',
  'tobillo_pie'
);

create type public.injury_laterality as enum (
  'derecha',
  'izquierda',
  'bilateral',
  'no_aplica'
);

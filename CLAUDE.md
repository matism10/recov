@AGENTS.md
## Contexto de Recov

Recov es una plataforma web de seguimiento de lesiones para clubes deportivos amateur (7 deportes: fútbol, futsal, rugby, handball, vóleibol, básquetbol, hockey césped; cada club tiene uno, fijado al crearlo). Es un proyecto del Taller de Emprendimiento Tecnológico y Sostenibilidad (UAI). Su propuesta de valor es la simplicidad: una versión simple y barata de las plataformas pensadas para clubes profesionales, con una interfaz clara y atractiva. La interfaz va en español.

**Stack:** Next.js (App Router) + Supabase (Auth, Postgres con RLS, Storage) + Vercel.

**Roles** (`profiles.roles` es un arreglo: una persona puede tener varios):
- **Dirección:** `head_coach` y `manager`. Confirman o rechazan registros (`/registros`) y gestionan el staff (`/staff`: roles y delegación).
- **Staff:** `head_coach`, `manager`, `entrenador`, `kinesiologo`, `nutricionista`, `preparador_fisico`. Ven lesiones, fases y la ficha de cada jugador.
- **Gestionan lesiones:** `kinesiologo`, la persona en quien el head coach delegó sus funciones (`clubs.kine_delegate_id`) y `head_coach`. Marcan lesionados, revisan (confirmar, descartar, dar de alta), editan fases y cambian la disponibilidad. Los documentos médicos los ven el kinesiólogo, su delegado y el head coach.
- **`jugador`:** reporta o completa su propia lesión con documentos, ve sus lesiones y fases, y el plantel.

Todo usuario nuevo entra por el link del club (`/c/[slug]`) y queda `pendiente` hasta que la dirección lo confirma.

**Flujo de una lesión:**
1. Entra al sistema de dos formas: el kine la marca en terreno ("Marcar lesionado": lesión `en_evaluacion`, jugador `en_revision`) y el jugador completa su diagnóstico, o el jugador la reporta por su cuenta. En ambos casos queda `activa` sin revisar.
2. Aparece en la bandeja "Por revisar". Se confirma (gravedad, alta estimada, disponibilidad) o se descarta.
3. Recuperación: fases editables (plantilla Reposo → Rehabilitación → Readaptación → Reintegro); la fase "Reintegro" en curso pone al jugador en `reintegro`.
4. Alta: la lesión queda `cerrada` y el jugador vuelve a `disponible` si no tiene otra abierta.

**Estados:**
- Disponibilidad del jugador: `disponible`, `en_revision` (solo al marcarlo lesionado), `lesionado`, `reintegro`. Los dos últimos forman "Lesiones activas".
- Lesión: `en_evaluacion`, `activa`, `cerrada`, `descartada`.
- Fase: `pendiente`, `en_curso`, `completada`; las quitadas se marcan con `archived_at`.

**Deportes y posiciones:** el catálogo vive en `sports` y `positions` (0005 y 0016). Desde 0016, el trigger `players_validate_position` valida que `players.position` y `secondary_position` existan en `positions` del deporte del club (en todo insert o update, también directo); la posición puede ser nula.

**Calendario de eventos (0022):** tabla `events` (`type` `entrenamiento` | `competencia`, `starts_at`/`ends_at`, `location`, `opponent` solo en competencias, `notes`, `series_id` para repeticiones, anulación con `cancelled_at`/`cancelled_by`; no se borran).
- Lectura: todos los confirmados del club (también jugadores), por RLS. Sin escritura directa: `authenticated` solo tiene `SELECT`.
- `create_event` (con `p_weeks` 1–12 para repetir entrenamientos cada semana en hora de Chile, mismo `series_id`), `update_event` y `cancel_event`: solo `head_coach`, `manager` y `entrenador`.
- `event_availability(event_id)`: solo staff. Devuelve por jugador confirmado y activo `ok` | `duda` | `no`, nunca fechas ni diagnóstico.
  - Evento pasado: último `availability_log.to_status` antes de `starts_at` (`disponible` → ok, `lesionado` → no, resto → duda); sin registro previo, el jugador no aparece.
  - Evento futuro: con lesión abierta y alta estimada, antes del alta → no, el día del alta o alta vencida → duda, después → ok. Sin lesión abierta o con alguna sin fecha, según la disponibilidad actual (`disponible` → ok; `lesionado` → no hasta 14 días y duda después; resto → duda). Gana el estado más restrictivo.

**Nóminas y carga del plantel (0027, 0028, 0029):** la convocatoria cuelga del evento de competencia (no hay tabla de partidos).
- Tablas: `event_callups` (convocatoria; `unique (event_id, player_id)`; quitar a alguien lo archiva con `removed_at`, no se borra) y `event_participations` (una fila por convocado; `mode` en que se cargó, `minutes`, `range_bucket` 0–4, `played`, `recorded_by`/`recorded_at`). Sin escritura directa.
- Modo por club: `clubs.nomina_mode` (`exacto` | `rango` | `jugo`, enum `nomina_mode`, por defecto `rango`), lo cambia la dirección con `set_nomina_mode`. Lo ya cargado conserva su modo.
- Escriben: `head_coach`, `manager` y el delegado `clubs.nomina_delegate_id` (lo asigna la dirección en /staff con `set_nomina_delegate`), con `set_event_callups` (lista completa) y `set_event_participation` (lote, todo o nada; solo competencias ya empezadas; exige y deriva los campos según el modo; tope de minutos del deporte).
- Leen: todo el staff del club; el jugador solo sus propias filas (RLS por `player_id`).
- Escala por deporte: columnas `match_minutes`, `max_minutes`, `bucket2_from`, `bucket3_from`, `bucket4_from` en `sports` (única fuente de verdad). `sport_load_scale(sport)` da etiquetas y puntos medios; `private.load_bucket` deriva el rango. Agregar un deporte es agregar una fila.
- Métricas: `team_match_load(p_matches)` (staff; ventana = últimos partidos con participación cargada; no convocado = 0; semáforo con 3+ partidos) y `my_match_load()` (solo el jugador autenticado: sus últimos 6, total, referencia agregada del plantel y sus convocatorias; sin semáforo). Un dato menos detallado que el modo actual no se estima hacia arriba (cuenta en `other_mode`).
- Puestos (0029): `event_callups.slot` (1 a `sports.starters` = titulares; los siguientes `sports.bench_size` = banca; en rugby 1–15 y 16–23). Un puesto por partido (índice único parcial); se puede convocar sin puesto; no más de titulares + banca. Se guarda con `set_event_lineup(event_id, [{player_id, slot}])`. La ubicación de cada puesto en la cancha y su código (número en rugby, iniciales en el resto) viven en `src/lib/pitch.ts` (solo presentación).
- Pantallas: `/nominas` (staff; "Armar nómina" lleva al próximo partido o a `/nominas/sin-partido`), la nómina de cada partido en `/calendario/[id]/disponibles` (lista o cancha con banca) y la participación en `/calendario/[id]/participacion`.
- Pruebas: `supabase/tests/match_load_test.sql`.

**Ajustes del club (Configuración, solo dirección):**
- Métricas del Resumen (0023, 0024): `clubs.dashboard_metrics` (computador) y `dashboard_metrics_mobile` (celular), claves del catálogo `private.dashboard_metric_keys()`; NULL = las de siempre. Las elige solo el `head_coach` con `set_dashboard_metrics` y `set_dashboard_metrics_mobile`.
- Identidad (0025, 0026): `clubs.category` (2–40 caracteres o NULL) es fija: la ponemos nosotros por SQL al crear el club (`set_club_category` quedó sin permisos para nadie). La portada (`clubs.cover_path`, con `set_club_cover`) va en el bucket privado `club-covers/{club_id}/…` (5 MB): la leen solo los confirmados del club (URL firmada) y la suben o borran solo la dirección. Su encuadre es `cover_position_x/y` (object-position en %, 0–100, por defecto 50) con `set_club_cover_position`; una portada nueva vuelve al centro. El encabezado del club (`ClubHeader`) la muestra en el Resumen.

**Convención:** las escrituras sensibles van por funciones `SECURITY DEFINER` con permisos explícitos (`mark_player_injured`, `review_injury`, `set_injury_phases`, `set_player_availability`, etc.), no por updates directos desde la app. En la app, `canManageInjuries` e `isDirection` (`src/lib/roles.ts`) solo deciden qué se muestra.

### Reglas que no se rompen

- **Aislamiento por club:** toda tabla lleva `club_id` y la seguridad la define RLS en la base de datos, no el frontend. Nunca usar la service role key en código de cliente.
- **Datos de salud:** de sus compañeros, el jugador solo ve la disponibilidad y el nombre de la fase de recuperación en curso (`squad_current_phases`); nunca el tipo de lesión, fechas ni documentos de otros. De sus propias lesiones ve todo, incluidas las fases. Los documentos médicos los revisa solo el kinesiólogo. El entrenador ve disponibilidad, lesiones y fases.
- **Cambios de base de datos:** el agente escribe y aplica las migraciones por el MCP de Supabase (proyecto "Recov"). Por cada cambio:
  1. Migración nueva en `supabase/migrations/` (siguiente número de cuatro dígitos) y sus pruebas en `supabase/tests/`: `rls_isolation_test.sql` (aislamiento y permisos) , `injury_lifecycle_test.sql` (ciclo de la lesión y fases), `events_test.sql` (calendario de eventos) o `match_load_test.sql` (nóminas y carga).
  2. Aplicarla con `apply_migration`, con el mismo contenido del archivo.
  3. Correr los tests con `execute_sql` (terminan en `ROLLBACK`). Si hay un "FAIL", corregir con una migración nueva y avisar a Mati.
  4. Revisar `get_advisors` (seguridad) y avisar si aparece algo nuevo.
  Nunca editar una migración ya aplicada. Los cambios de enum (`alter type ... add value`) van en una migración propia. Preguntar a Mati antes de cualquier `DROP TABLE`, `TRUNCATE`, `DELETE` sobre datos o de hacer más permisiva una política RLS.
- **Datos:** solo datos ficticios. Nunca commitear `.env.local` ni claves.
- **Git:** trabajar en ramas y abrir pull request. `main` está protegida.
- **Next.js 16:** `middleware` ahora se llama `proxy.ts`. Antes de usar una API, leer `node_modules/next/dist/docs/`.
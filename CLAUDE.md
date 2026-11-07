@AGENTS.md
## Contexto de Recov

Recov es una plataforma web de seguimiento de lesiones para clubes deportivos amateur (7 deportes: fútbol, futsal, rugby, handball, vóleibol, básquetbol, hockey césped; cada club tiene uno, fijado al crearlo). Es un proyecto del Taller de Emprendimiento Tecnológico y Sostenibilidad (UAI). Su propuesta de valor es la simplicidad: una versión simple y barata de las plataformas pensadas para clubes profesionales, con una interfaz clara y atractiva. La interfaz va en español.

**Stack:** Next.js (App Router) + Supabase (Auth, Postgres con RLS, Storage) + Vercel.

**Marca:** el logo oficial (confirmado el 22 oct 2026) está en `docs/brand/` (ver su README). Todo uso del logo sale de `docs/brand/recov-logo.png` (recortado, esquinas transparentes); en la app: `src/app/recov-logo.png` (menú), `icon.png` y `favicon.ico` (pestaña) y `public/icons/` (Web App instalable: manifest en `src/app/manifest.ts`, ícono de iPhone `apple-touch-icon.png`). Celeste del logo: `#0CA9FE`.

**Roles** (`profiles.roles` es un arreglo: una persona puede tener varios):
- **Dirección:** `head_coach` y `manager`. Confirman o rechazan registros (`/registros`) y gestionan el staff (`/staff`: roles y delegación).
- **Staff:** `head_coach`, `manager`, `entrenador`, `kinesiologo`, `nutricionista`, `preparador_fisico`. Ven lesiones, fases y la ficha de cada jugador.
- **Gestionan lesiones:** `kinesiologo`, la persona en quien el head coach delegó sus funciones (`clubs.kine_delegate_id`) y `head_coach`. Marcan lesionados, revisan (confirmar, descartar, dar de alta), editan fases y cambian la disponibilidad. Los documentos médicos los ven el kinesiólogo, su delegado y el head coach.
- **`jugador`:** reporta o completa su propia lesión con documentos, ve sus lesiones y fases, y el plantel.

Todo usuario nuevo entra por el link del club (`/c/[slug]`) y queda `pendiente` hasta que la dirección lo confirma.

**Permisos del staff (20261106120000–122000):** rol = plantilla de permisos + ajustes por persona. Catálogo en `private.permissions` (claves como `lesiones_ver`, `lesionado_marcar`, `eventos_editar`, `nomina_armar`, `gimnasio_planes`, `registros_aprobar`, `posicion_cambiar`; no delegables: `staff_gestionar`, `sevens_activar`, `sevens_grupo`), plantillas en `private.role_permissions` y ajustes en `member_permissions` (sin escritura directa; restablecer archiva).
- La base decide con `private.has_perm(club, perm)` (rol + delegaciones de `kine_delegate_id`/`nomina_delegate_id` + ajuste vigente; el head coach tiene todo). Funciones y políticas nuevas deben usar `has_perm`, no listas de roles.
- Head coach principal: `club_members.is_principal` (uno por club; trigger lo protege y lo asigna al primer head coach). Co-head coach = head coach que no es principal. Solo un head coach nombra head coach (`set_staff_roles`) y edita permisos (`set_member_permission`, `reset_member_permissions`); solo el principal modifica a un co-head coach.
- App: `getProfile` trae `my_permissions` y lo pega a `roles` (`src/lib/permissions.ts`, `can(roles, perm)`); `roles.ts`, `gym-roles.ts`, `evaluations.ts` y `nav-slots.ts` son fachada. Sin permisos pegados (componentes de cliente) se usa la plantilla del rol. Pantallas: `/staff` y `/staff/[id]`.

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
- Leen: todo el staff del club. El jugador confirmado ve la convocatoria completa de su club (`event_callups`, desde 0048, en lectura en `/nominas/[eventId]`) y de `event_participations` solo sus propias filas (RLS por `player_id`).
- Escala por deporte: columnas `match_minutes`, `max_minutes`, `bucket2_from`, `bucket3_from`, `bucket4_from` en `sports` (única fuente de verdad). `sport_load_scale(sport)` da etiquetas y puntos medios; `private.load_bucket` deriva el rango. Agregar un deporte es agregar una fila.
- Métricas: `team_match_load(p_matches)` (staff; ventana = últimos partidos con participación cargada; no convocado = 0; semáforo con 3+ partidos) y `my_match_load()` (solo el jugador autenticado: sus últimos 6, total, referencia agregada del plantel y sus convocatorias; sin semáforo). Un dato menos detallado que el modo actual no se estima hacia arriba (cuenta en `other_mode`).
- Puestos (0029): `event_callups.slot` (1 a `sports.starters` = titulares; los siguientes `sports.bench_size` = banca; en rugby 1–15 y 16–23). Un puesto por partido (índice único parcial); se puede convocar sin puesto; no más de titulares + banca. Se guarda con `set_event_lineup(event_id, [{player_id, slot}])`. La ubicación de cada puesto en la cancha y su código (número en rugby, iniciales en el resto) viven en `src/lib/pitch.ts` (solo presentación).
- Pantallas: `/nominas` (staff; "Armar nómina" lleva al próximo partido o a `/nominas/sin-partido`), la nómina de cada partido en `/calendario/[id]/disponibles` (lista o cancha con banca) y la participación en `/calendario/[id]/participacion`.
- Pruebas: `supabase/tests/match_load_test.sql`.

**Teléfono del jugador (0030):** tabla `player_contacts` (`player_id` PK, `club_id`, `phone` en formato `+56912345678`), con RLS y sin políticas: no se lee ni escribe directo. `set_my_phone(p_phone)` lo guarda el propio jugador (también pendiente); `null` o `''` lo borra. `get_player_phone(p_player_id)` lo devuelve al propio jugador o al staff confirmado del club si el jugador está confirmado; si no, `null`. En la app: campo opcional al registrarse como jugador (`/c/[slug]`) y sección "Contacto" en `/perfil` (solo jugadores confirmados); normalización a E.164 en `src/lib/phone.ts` (sin prefijo asume +56).

**Correo al confirmar un registro:** lo envía la acción de `/registros` (`src/app/registros/actions.ts`) después de un `review_member` exitoso. El correo de la persona se lee con `getUserEmail` (`src/lib/supabase/admin.ts`, `server-only`, clave `SUPABASE_SERVICE_ROLE_KEY` solo en el servidor) y se envía con `sendEmail` (`src/lib/email.ts`, nodemailer por SMTP; variables `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM`). Para pasar a Resend se cambia solo `email.ts`. Si el correo falla o falta configuración, la confirmación se mantiene y `/registros?correo=no-enviado` muestra un aviso. La pantalla `/pendiente` revisa el propio perfil cada 10 s (pausa con la pestaña oculta) y lleva al Resumen al confirmarse. La vía anterior por base de datos (0031–0033) se quitó en 0034; quedan sin uso `private.member_emails` y la extensión `pg_net`.

**Correo al registrarse y recuperar contraseña (0035, 0036):**
- Al registrarse se revisa que el dominio del correo reciba mensajes (`src/lib/email-domain.ts`, MX o A; si el DNS falla no bloquea). No se pide verificar el correo: 0035 lo exigía para aprobar y 0036 lo quitó (`review_member` volvió a lo de antes). Quedan sin uso `profiles.email_verified_at`, `private.email_verification_tokens`, `create_email_verification` y `verify_email` (sin permisos para la app).
- Recuperar contraseña: `/recuperar` (respuesta igual exista o no la cuenta) envía un link a `/restablecer?token=…` con el hash de `auth.admin.generateLink({ type: "recovery" })`; el link se usa al enviar la contraseña nueva (`verifyOtp` + `updateUser`), no al abrir la página.
- Límite: `allow_auth_email` (solo `service_role`; 1 por minuto y 5 por hora por correo; guarda el hash del correo en `private.auth_email_log`).
- Todo sale por `sendEmail`; las funciones con clave de servicio están en `src/lib/supabase/admin.ts`.

**Ajustes del club (Configuración, solo dirección):**
- Métricas del Resumen (0023, 0024): `clubs.dashboard_metrics` (computador) y `dashboard_metrics_mobile` (celular), claves del catálogo `private.dashboard_metric_keys()`; NULL = las de siempre. Las elige solo el `head_coach` con `set_dashboard_metrics` y `set_dashboard_metrics_mobile`.
- Identidad (0025, 0026): `clubs.category` (2–40 caracteres o NULL) es fija: la ponemos nosotros por SQL al crear el club (`set_club_category` quedó sin permisos para nadie). La portada (`clubs.cover_path`, con `set_club_cover`) va en el bucket privado `club-covers/{club_id}/…` (5 MB): la leen solo los confirmados del club (URL firmada) y la suben o borran solo la dirección. Su encuadre es `cover_position_x/y` (object-position en %, 0–100, por defecto 50) con `set_club_cover_position`; una portada nueva vuelve al centro. El encabezado del club (`ClubHeader`) la muestra en el Resumen.

**Rugby Sevens (0045):** no es un deporte ni un club nuevo: es un grupo con formato dentro del mismo plantel de rugby (mismo `club_id`, fichas, lesiones, disponibilidad y evaluaciones).
- Formatos `'15'` (escala y nómina en `sports`) y `'7'` (en `sport_format_config`; usar `private.sport_format(sport, format)`). `positions.format` separa los catálogos: la ficha (`players.position`) siempre es del 15 y la app filtra `positions` por `format`.
- `clubs.has_sevens` (solo rugby; `set_club_sevens`, dirección). `sevens_group` (`member_id` = `club_members.user_id`, posición de Sevens propia; archivar no borra): lo arma la dirección con `set_sevens_group` (lista completa) y cada miembro elige su posición con `set_my_sevens_position`. Lectura: confirmados del club.
- `events.format` (`'7'` solo con `has_sevens`; `create_event(..., p_format)`). Nómina, participación y carga siguen el formato del evento; `team_match_load(n, formato)` y `my_match_load(formato)` (sin formato = 15; en 7 el plantel es el grupo).
- App: formato activo en la cookie `recov_format` (`getActiveFormat`/`getFormatContext` en `src/lib/format.ts`; tipos y textos para el cliente en `src/lib/sevens.ts`). Es '7' solo con `has_sevens` y si la cuenta está en el grupo o es de la dirección; cambiar de plantel lo vuelve a '15'. Selector solo arriba del Resumen; para quien tiene los dos formatos, chip "Rugby 15" o "Sevens" en el encabezado de cada pantalla. Métricas por formato con `dash_*(…, p_format)` (0046). En '7' las listas de jugadores son el grupo (`inFormat`) y todo lo de eventos filtra `events.format`; las listas de lesiones ("Por revisar" del Resumen y `/lesiones`) muestran solo las del grupo (`formatPlayerIds`); el detalle de una lesión, documentos, fases y evaluaciones no se separan. La nómina y la participación siguen el formato del evento (cancha `sevens` en `src/lib/pitch.ts`). Dirección: "Activar Sevens" en Configuración y `/configuracion/sevens`.

**sRPE y check de bienestar (20261105180000, 20261105190000):** autorreportes del jugador para controlar la carga. En la interfaz nunca se dice "riesgo de lesión": se usa "Carga alta" y "Bajo lo habitual".
- `session_rpe` (PK evento + jugador; `rpe` 0–10 o `absent`): lo escribe solo `submit_session_rpe` (jugador confirmado y activo; evento del plantel, no cancelado, ya empezado y hasta 48 h después del término; en Sevens, del grupo; en competencias, convocado; en entrenamientos, no ausente en la lista; se puede corregir en el plazo). Los minutos no se guardan: `private.session_minutes` los calcula al leer (entrenamiento: término − inicio; partido: minutos exactos, 0 si no jugó, o `match_minutes` del formato, estimado, en rango, jugó o sin participación).
- `wellness_reports` (5 ítems 1–5, 5 = mejor; `total` generado sobre 25; único por jugador y fecha): solo `submit_wellness`, los días de `clubs.wellness_days` (ISO 1–7, por defecto lunes; `set_wellness_days`: head coach, manager o preparador físico) o al día siguiente, en hora de Chile.
- RLS de las dos tablas: staff confirmado ve todo el club; el jugador, solo lo suyo. Sin escritura directa.
- Lecturas (por formato, como 0046): `my_pending_reports`, `my_session_report` (jugador), `event_rpe_summary`, `team_srpe_load`, `wellness_flags` (staff) y `player_weekly_load` (staff o el propio jugador). Umbrales provisorios: carga alta = semana actual > 1,3 × promedio de las 4 anteriores con datos (al menos 3); bienestar bajo = total ≤ promedio de los 4 anteriores − 4 (al menos 3) o algún ítem en 1.
- Pantallas: "Pendientes" y "Mi bienestar" en el Resumen del jugador, `/reportar/[eventId]`, `/bienestar`, `/calendario/[id]/reportes` (staff), "Carga" y "Bienestar" en la ficha, tarjeta "Carga sRPE" en Métricas y la sección "Check de bienestar" en Configuración (el preparador físico entra solo a esa sección). Textos y tipos en `src/lib/srpe.ts`.

**Plan de gimnasio (20261105200000–210000):** fuerza y acondicionamiento; sin formato (cuenta en '15' y en '7').
- Tablas `gym_plans` (`borrador` | `publicado` | `archivado`), `gym_plan_sessions` (día ISO), `gym_plan_exercises` (intensidad `pct` con test en kilos, `rpe`, `kg`, `bw` o `tiempo` con `seconds` y sin reps; `block` = nombre del bloque; `superset` = ejercicios seguidos del mismo bloque con el mismo número, códigos A, B1, B2 en `src/lib/gym-groups.ts`), `gym_plan_targets` (`plantel`, `posicion`, `jugador`, `sevens`), `gym_plan_exclusions` y `gym_session_logs`. Nada se borra: `save_gym_plan` (plan completo) archiva lo quitado y conserva el id de lo que sigue.
- Escriben planes `head_coach` y `preparador_fisico` (`save_gym_plan`, `publish_gym_plan`, `archive_gym_plan`). Las tablas de planes las lee solo el staff; el jugador ve lo suyo por `my_gym_today`, `my_gym_week` y `my_gym_log_summary`. Registros: staff del club o el propio jugador.
- Destinatarios: `private.gym_plan_players` (los lesionados lo reciben salvo exclusión). Asignaciones por día: `private.gym_assignments` (desde la publicación). Kilos = último `test_results` no anulado × % redondeado a 2,5 kg.
- Jugador: `complete_gym_session`, `log_own_gym_session` y `submit_gym_rpe`, el día de la sesión o hasta 2 días después. El gimnasio con esfuerzo suma a la carga (`private.load_sessions`); desglose por tipo en `player_weekly_load` y `team_load_breakdown`; cumplimiento en `gym_adherence`, `player_gym_summary` y `gym_plan_progress`.
- App: `/planes` (editor en `src/app/planes/`), `/mi-plan` (y `listo`, `esfuerzo`, `propia`), "Hoy toca gimnasio" y "Mi semana" en el Resumen. Textos y tipos en `src/lib/gym.ts`. Barra: `planes` y `mi_plan`; la barra por defecto del jugador es Resumen, Calendario, Mi plan.

**Convención:** las escrituras sensibles van por funciones `SECURITY DEFINER` con permisos explícitos (`mark_player_injured`, `review_injury`, `set_injury_phases`, `set_player_availability`, etc.), no por updates directos desde la app. En la app, `canManageInjuries` e `isDirection` (`src/lib/roles.ts`) solo deciden qué se muestra.

### Reglas que no se rompen

- **Aislamiento por club:** toda tabla lleva `club_id` y la seguridad la define RLS en la base de datos, no el frontend. Nunca usar la service role key en código de cliente.
- **Datos de salud:** de sus compañeros, el jugador solo ve la disponibilidad y el nombre de la fase de recuperación en curso (`squad_current_phases`); nunca el tipo de lesión, fechas ni documentos de otros. De sus propias lesiones ve todo, incluidas las fases. Los documentos médicos los revisa solo el kinesiólogo. El entrenador ve disponibilidad, lesiones y fases.
- **Cambios de base de datos:** el agente escribe y aplica las migraciones por el MCP de Supabase (proyecto "Recov"). Por cada cambio:
  1. Migración nueva en `supabase/migrations/` con nombre de fecha y hora (`AAAAMMDDHHMMSS_descripcion.sql`, por ejemplo `20261105120000_event_attendance.sql`; las anteriores a nov 2026 usan cuatro dígitos, 0001–0048) y sus pruebas en `supabase/tests/`: `rls_isolation_test.sql` (aislamiento y permisos) , `injury_lifecycle_test.sql` (ciclo de la lesión y fases), `events_test.sql` (calendario de eventos y asistencia), `match_load_test.sql` (nóminas y carga), `evaluaciones_test.sql` (evaluaciones), `sevens_test.sql` (Rugby Sevens), `load_wellness_test.sql` (sRPE y bienestar), `gym_plan_test.sql` (plan de gimnasio) o `staff_permissions_test.sql` (permisos del staff).
  2. Aplicarla con `apply_migration`, con el mismo contenido del archivo.
  3. Correr los tests con `execute_sql` (terminan en `ROLLBACK`). Si hay un "FAIL", corregir con una migración nueva y avisar a Mati.
  4. Revisar `get_advisors` (seguridad) y avisar si aparece algo nuevo.
  Nunca editar una migración ya aplicada. Los cambios de enum (`alter type ... add value`) van en una migración propia. Preguntar a Mati antes de cualquier `DROP TABLE`, `TRUNCATE`, `DELETE` sobre datos o de hacer más permisiva una política RLS.
- **Datos:** solo datos ficticios. Nunca commitear `.env.local` ni claves.
- **Git:** trabajar en ramas y abrir pull request. `main` está protegida.
- **Next.js 16:** `middleware` ahora se llama `proxy.ts`. Antes de usar una API, leer `node_modules/next/dist/docs/`.
## Estado de la plataforma
Antes de abrir cada PR, actualiza docs/estado-actual.md en el mismo commit:
- Historial: fecha, nº de PR, qué cambió (1 línea).
- Si hubo migración: número y qué hace.
- Si cambió una pantalla, rol, permiso o regla: edita esa sección (no agregues duplicados).
- Mueve a Pendientes lo que quedó sin hacer; borra lo resuelto.
- Mantén el archivo bajo ~400 líneas; si crece, resume lo antiguo.
No leas el archivo completo para esto: edita solo las secciones afectadas.

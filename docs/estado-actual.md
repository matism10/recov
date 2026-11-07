# Recov: estado actual de la plataforma (6 nov 2026)

Plataforma web de seguimiento de lesiones para clubes deportivos amateur (7 deportes: fútbol, futsal, rugby, handball, vóleibol, básquetbol, hockey césped; cada club tiene uno, fijado al crearlo). Proyecto del Taller de Emprendimiento Tecnológico y Sostenibilidad (UAI). Interfaz en español; pruebas y demos solo con datos ficticios. Primer plantel real: Old Locks M16 (25 oct).

**Stack:** Next.js 16 (App Router; `middleware` se llama `proxy.ts`) + Supabase (Auth, Postgres con RLS, Storage) + Vercel. Supabase se maneja por MCP (proyecto "Recov").

## Estado del repositorio
- Todo está mergeado en `main` (último: PR #90, 5 nov). En curso: plan de gimnasio (`feat/plan-gimnasio`).
- Migraciones 0001 a 0048, 20261104230000 a 20261104233000, 20261105120000, 20261105180000, 20261105190000 y 20261105200000 a 20261105210000 aplicadas en Supabase (por MCP o, cuando el MCP rechaza `DROP`, por el SQL Editor). 0043 se aplicó desde el SQL Editor y falta anotarla en `supabase_migrations.schema_migrations`.
- 43 pantallas (rutas de página en `src/app`).
- 0016: 7 deportes y 44 posiciones (en rugby, "Ala" pasó a "Flanker"; hockey reemplazó su catálogo). El trigger `players_validate_position` valida que `players.position` y `secondary_position` existan en `positions` del deporte del club, también en inserts y updates directos.
- Tests (terminan en ROLLBACK, todos pasan): `supabase/tests/rls_isolation_test.sql` (aislamiento y permisos), `injury_lifecycle_test.sql` (ciclo de la lesión y fases), `events_test.sql` (calendario y asistencia), `match_load_test.sql` (nóminas y carga), `evaluaciones_test.sql` (evaluaciones), `sevens_test.sql` (Rugby Sevens), `load_wellness_test.sql` (sRPE y bienestar) y `gym_plan_test.sql` (plan de gimnasio). En la app, `npm test` (node --test) prueba el lado sugerido y el texto de la zona (`src/lib/body-zones.test.ts`).
- 0027 y 0028 (20 oct 2026): nóminas, participación y carga del plantel. 0029: nómina por puestos (titulares y banca). 0030: teléfono opcional del jugador (solo base de datos, sin UI).
- CLAUDE.md está al día con roles, flujo, estados, reglas y el flujo de trabajo de migraciones.
- Migraciones desde el 21 oct:
  - 0031–0034: correo al confirmar un registro; primero por base (pg_net) y luego desde la app (0034 quita la vía por base).
  - 0035–0036: verificación de correo (0035) y su retiro (0036); límite de correos de Auth (`allow_auth_email`).
  - 0037: `club_members` (membresías por plantel, sincronizadas desde `profiles`).
  - 0038: helpers con `club_id` y políticas RLS que los usan.
  - 0039: las funciones públicas escriben en `club_members` (`p_club_id` opcional); delegados con FK a `club_members`.
  - 0040: foto de perfil en la carpeta de cualquier plantel de la cuenta.
  - 0041: plantel activo por el header `x-club-id` (`private.active_club_id()`).
  - 0042: `club_public_card(slug)`: nombre, deporte y categoría del link sin sesión.
  - 0043: `profiles` queda solo como identidad (sin `club_id`, `roles`, `status`, `requested_role`); respaldo en `private.profiles_legacy_backup`.
  - 0044: evaluaciones físicas (`test_definitions`, `test_results` y sus funciones).
  - 0045: Rugby Sevens: `clubs.has_sevens`, `positions.format`, `sevens_group`, `events.format`, `sport_format_config`, `create_event` con `p_format` y carga por formato.
  - 0046: métricas por formato: `dash_*(…, p_format)` (en '7' solo el grupo Sevens y su posición de Sevens); las de siempre no cambian.
  - 0047: barra inferior móvil por cuenta y plantel: `nav_preferences` (`slots` NULL = por defecto; RLS: solo la fila propia del plantel activo) y `set_nav_slots` (valida cantidad y pantallas del rol con `private.nav_allowed_screens`).
  - 20261104230000–20261104230200 (registro de lesión v2; nombre con fecha y hora, no con número):
    - 230000: enums `body_zone` (19 zonas) e `injury_laterality` (derecha, izquierda, bilateral, no_aplica).
    - 230100: `injuries.body_zone` y `injuries.laterality` (nulas o ambas con valor) y `delete_own_draft_document(document_id)`: el jugador quita un documento suyo en borrador si la lesión no tiene `reviewed_at`; devuelve el `storage_path` y el servidor borra el archivo con la clave de servicio.
    - 230200: `report_injury` y `complete_injury_report` nuevas (con `p_body_zone`, `p_laterality` y 0 a 5 documentos; `injuries.type` = "<Zona> <lado>" con `private.injury_zone_type`), `add_own_injury_document` (agregar o reemplazar antes de la revisión, máximo 5) y `private.check_player_files`.
    - 233000: tras el deploy de #86, las versiones anteriores de `report_injury` (tipo libre) y `complete_injury_report` quedan sin permisos (no se borran).
  - 20261105120000: asistencia a entrenamientos. Tabla `event_attendance` (`event_id`, `player_id`, `club_id`, `present`, `recorded_by`, `recorded_at`; PK evento + jugador; RLS: el staff confirmado lee las del club y el jugador solo sus filas; sin escritura directa). `set_event_attendance(event_id, ausentes[])` (cualquier staff; solo entrenamientos no cancelados y ya empezados; inserta o actualiza una fila por jugador confirmado y activo, y en un entrenamiento Sevens solo el grupo). `attendance_ranking(desde, hasta)` (todo confirmado: asistidos/total por jugador activo; solo eventos con lista y no cancelados; fechas en hora de Chile). `private.dashboard_metric_keys()` suma `'asistencia'` (no cambia las métricas de ningún club).
  - 20261105180000: sRPE y check de bienestar. `clubs.wellness_days` (días ISO, por defecto lunes) y `set_wellness_days` (head coach, manager o preparador físico). Tablas `session_rpe` (esfuerzo 0–10 o "no fui" por evento y jugador) y `wellness_reports` (5 ítems 1–5 y total sobre 25 por fecha); RLS: staff confirmado ve todo el club y el jugador solo lo suyo; sin escritura directa. `submit_session_rpe` y `submit_wellness` (jugador), `my_pending_reports`, `event_rpe_summary`, `player_weekly_load`, `team_srpe_load` y `wellness_flags`; minutos calculados al leer con `private.session_minutes`.
  - 20261105190000: `my_session_report(event_id)`: una sesión del propio jugador (minutos, respuesta guardada y si aún puede responder), para corregir la respuesta en `/reportar/[eventId]`.
  - 20261105200000: plan de gimnasio. Tablas `gym_plans` (nombre, vigencia, `borrador` | `publicado` | `archivado`), `gym_plan_sessions` (día ISO, minutos estimados), `gym_plan_exercises` (series, reps en texto, intensidad `pct` con test en kilos, `rpe`, `kg` o `bw`, descanso, nota), `gym_plan_targets` (`plantel`, `posicion`, `jugador`, `sevens`) y `gym_plan_exclusions`; lo quitado se marca con `archived_at` y lo que sigue conserva su id. `gym_session_logs` (sesión del plan o por su cuenta, día, minutos, esfuerzo, ejercicios marcados). RLS: planes solo para el staff; registros, staff del club o el propio jugador; sin escritura directa. `save_gym_plan`, `publish_gym_plan` y `archive_gym_plan` (head coach o preparador físico), `complete_gym_session`, `log_own_gym_session` y `submit_gym_rpe` (jugador, el día de la sesión o hasta 2 días después), `my_gym_today`, `my_gym_week` y `my_gym_log_summary`. Helpers `private.gym_plan_players` (destinatarios menos exclusiones; los lesionados lo reciben) y `private.gym_assignments` (sesiones asignadas por día, desde que se publicó).
  - 20261105201000: el gimnasio suma a la carga (`private.load_sessions`; un registro sin esfuerzo no suma; sin formato). `srpe_load_flag`, `player_weekly_load` (con `cancha`, `gimnasio` y `partido` por semana) y `my_pending_reports` (filas `gym`) se reemplazan sin cambiar firma; `team_srpe_load` ya suma el gimnasio y el desglose va en `team_load_breakdown`. `gym_adherence(desde, hasta)` y `player_gym_summary(player)`. Barra: `planes` y `mi_plan` en `nav_screen_keys` y `nav_allowed_screens`.
  - 20261105202000: `gym_plan_progress()`: por plan, jugadores que lo reciben y sesiones asignadas, que ya tocaban y hechas (lista `/planes`).
  - 20261105210000: bloques, superseries y tiempo en `gym_plan_exercises`: `block` (nombre del bloque, hasta 40), `superset` (1–30; seguidos con el mismo número = superserie) e intensidad `tiempo` con `seconds` (5 s a 60 min, sin reps; `reps` pasa a opcional solo para `tiempo`). `save_gym_plan` y `private.gym_session_exercises` se reemplazan con la misma firma.
  - 0048: Nóminas en lectura para el jugador: `event_callups_select` pasa a todo confirmado del club (antes staff o la fila propia; aprobado por Mati). `event_participations` no cambia. La barra ofrece Nóminas también al jugador.

## Historial
- 6 nov · #93 · Esfuerzo con "número grande" (sin migración): componente único `EffortPicker`/`EffortScreen` en `/reportar/[eventId]`, `/mi-plan/esfuerzo/[logId]` y `/mi-plan/propia`; sin número por defecto y sin barra inferior en las pantallas de esfuerzo.
- 5 nov · #91 · Planes: bloques, superseries (A1, A2) e intensidad por tiempo (20261105210000).
- 5 nov · #91 · Editor de planes: selector Diaria (por defecto) / Semanal / Mensual.
- 5 nov · #91 · Plan de gimnasio (20261105200000–202000): `/planes` y el editor (escritorio y celular), "Hoy toca gimnasio" y "Mi semana" en el Resumen, `/mi-plan` con kilos calculados, pantalla de felicitaciones, sesión por su cuenta, esfuerzo del gimnasio en Pendientes, carga apilada por tipo y "Gimnasio" en la ficha, y carga por jugador con el plan en Métricas.
- 5 nov · #89 · sRPE y check de bienestar (20261105180000, 20261105190000): "Pendientes" y "Mi bienestar" en el Resumen del jugador, `/reportar/[eventId]`, `/bienestar`, "Reportes" en el detalle del evento, carga semanal y bienestar en la ficha, tarjeta "Carga sRPE" en Métricas y la sección "Check de bienestar" en Configuración.
- 5 nov · #88 · Asistencia a entrenamientos (20261105120000): "Pasar lista" en el detalle del entrenamiento, etiqueta "Asistencia sin registrar", métrica opcional "Asistencia a entrenamientos" en el Resumen y pantalla `/asistencia`.
- 4 nov · #87 · Versiones anteriores de `report_injury` y `complete_injury_report` sin permisos (20261104233000); los tests usan las versiones con zona.
- 4 nov · #86 · Registro de lesión v2: el jugador elige la zona en un mapa del cuerpo (Frente/Espalda, o lista) y el lado (sugerido según dónde tocó), el documento médico es opcional con Reemplazar/Eliminar hasta la revisión, el kine ve "Sin documento", zona y lado, y el Resumen del staff tiene el mapa "Zonas lesionadas".
- 2 nov · #85 · Abrir la Web App y cambiar Rugby 15 ↔ Sevens más rápido: `start_url` a `/dashboard` y "/" redirige desde el proxy (antes armaba la página; ~0,6 s menos), el selector de formato ya no pide la página dos veces (sin `router.refresh()`), el Resumen no espera al grupo Sevens para sus consultas (`withActiveFormat`), "Por revisar" en Sevens se filtra sin consultar las fichas del grupo y la franja de métricas llega aparte con su esqueleto. Medido con `next start`: abrir la app 1,24 s → 0,72 s (head coach); cambio de formato 1,2–1,4 s → 0,7 s.
- 2 nov · #84 · Navegación móvil: barra configurable por cuenta y plantel (0047), botón "Registrar lesión" del jugador, hoja "Más" en grilla con Perfil y Cerrar sesión, sección "Barra principal" en Perfil y Nóminas para todos (0048; el jugador en lectura en `/nominas/[eventId]`, también en la sidebar).
- 2 nov · #83 · Transiciones más rápidas: semana/mes del calendario y pestañas del link del plantel sin ir al servidor, sesión con `getClaims` (sin viaje a Auth), pantallas visitadas al instante por 30 s (`staleTimes`), formato 15 sin consultar el grupo Sevens y esqueletos en Evaluaciones.
- 28 oct · #81 · Rugby Sevens, app: formato activo, selector en el Resumen, filtros por formato, nómina Sevens y Grupo Sevens.
- 28 oct · #82 · Sevens: métricas por formato (0046), cancha horizontal de Sevens también en el Plantel, indicador de formato en el encabezado, aviso de posición solo para jugadores, lesiones separadas por formato y degradado más leve en la portada del celular.
- 28 oct · #80 · Rugby Sevens, base de datos (0045); la app filtra posiciones al formato 15.
- 26 oct · #79 · `docs/estado-actual.md` al día y regla para mantenerlo en `CLAUDE.md`.
- 25 oct · #78 · Evaluaciones físicas (0044): carga, comparación del plantel y "Mis evaluaciones".
- 25 oct · #77 · `profiles` solo identidad (0043); `getProfile` sin `profiles.club_id`.
- 25 oct · #76 · Competencias solo con hora de inicio (el término se guarda a las 2 h, oculto).
- 25 oct · #75 · Multi-plantel en la app: plantel activo, selector y link `/c/[slug]` con unirse.
- 25 oct · #74 · Plantel activo por el header `x-club-id` (0041).
- 24 oct · #73 · Funciones públicas sobre `club_members` (0039) y foto en cualquier plantel (0040).
- 24 oct · #72 · Helpers con `club_id` y políticas RLS (0038).
- 24 oct · #71 · `club_members` (0037).
- Semana del 19 oct (antes de #71): #69 recuperar contraseña y verificación de correo agregada y retirada (0035, 0036); #70 vista cancha del plantel; #61–#64 rendimiento (esqueletos de carga, consultas en paralelo, imágenes con caché); #65 logo final; #66 Web App instalable; #67 guía "¿Cómo instalo Recov?"; #68 correo al aprobar un registro (0031–0034).
- Hasta el 20 oct: #1–#60, migraciones 0001–0030 (base, lesiones y fases, calendario, nóminas y carga, teléfono del jugador).

## Flujo de la plataforma

**1. Entrada al plantel** (en la interfaz, "club" se llama "plantel")
- El link de cada plantel (`/c/[slug]`) muestra logo, nombre y categoría, con pestañas Registro | Iniciar sesión. Registro: jugador o staff, con foto y teléfono opcionales.
- Una cuenta puede estar en varios planteles: con sesión, el link ofrece "Únete a este plantel" (jugador con posiciones o staff con puesto) o "Unirme con otro correo".
- Queda **pendiente** hasta que la dirección la confirma o rechaza en `/registros`; al confirmar le llega un correo. `/pendiente` revisa cada 10 s y entra sola al confirmarse.
- Con 2 o más planteles, el encabezado tiene un selector; el plantel activo vive en la cookie `recov_club` y viaja como `x-club-id`. Roles y estado son por plantel (`club_members`).
- Recuperar contraseña en `/recuperar`. Recov se instala como Web App (guía en el login y el registro).

**2. Una lesión entra al sistema por uno de dos caminos**
- **A. El kine la ve en terreno:** en el plantel pulsa "Marcar lesionado" junto al jugador e indica dónde ocurrió (entrenamiento o competencia) y una nota breve. La lesión queda **En evaluación** y el jugador **En revisión**. Al jugador le aparece una tarjeta para subir su diagnóstico (zona del cuerpo y lado, duración que indicó el médico, detalle y documentos opcionales). Al subirlo, la lesión pasa a **Activa, sin revisar**.
- **B. El jugador la reporta por su cuenta** ("Registrar lesión"). Queda **Activa, sin revisar**.
- **Formulario del jugador** (los dos caminos, `src/app/registrar-lesion/injury-form.tsx`):
  - Zona en el mapa del cuerpo (`src/app/body-map.tsx`: figura anatómica oscura, zona elegida en celeste; cada región lleva `data-zone` = valor de `body_zone`) o en una lista. Una zona por lesión. Escritorio: Frente y Espalda lado a lado y el formulario a la derecha; celular: un cuerpo con cambio Frente/Espalda y la lista debajo.
  - Lado en chips Derecha / Izquierda / Bilateral / No aplica, sugerido según el lado tocado (de frente se invierte; las zonas centrales sugieren No aplica) y editable (`src/lib/body-zones.ts`).
  - Detalle opcional (`injuries.description`). `injuries.type` lo arma la base: "Isquiotibial derecho".
  - "Orden médica o examen (opcional)" con botón de información; se puede registrar sin archivo y no se le muestra al jugador ningún aviso de documento pendiente.
- **Documentos después de enviar:** en el detalle de su lesión, el jugador puede Reemplazar, Eliminar o adjuntar otro mientras la lesión está activa y sin revisar. Después de la revisión los botones quedan deshabilitados.

**3. Revisión**
- La lesión aparece en la bandeja **"Por revisar"** del kine, su delegado y el head coach. Si no tiene documentos lleva el indicador **"Sin documento"** (también en `/lesiones` y en el detalle; se calcula con `documents(count)`, sin columna nueva).
- Lista y detalle muestran zona y lado; el detalle, un mapa con la zona. Las lesiones antiguas sin zona se ven como antes (tipo libre).
- **Resumen del staff → "Zonas lesionadas":** mapa Frente/Espalda con las lesiones abiertas del plantel (en Sevens, del grupo) pintadas por cantidad (amarillo 1, naranjo 2, rojo 3 o más) y una lista por zona.
- Desde el detalle de la lesión se puede:
  - **Confirmar:** gravedad, fecha estimada de alta y disponibilidad (sugiere Lesionado).
  - **Descartar:** el jugador vuelve a Disponible si no tiene otra lesión abierta; si tiene otra activa, queda Lesionado.

**4. Recuperación**
- **Fases editables:** "Cargar fases sugeridas" crea Reposo → Rehabilitación → Readaptación → Reintegro, repartidas hasta el alta estimada. Se pueden renombrar, cambiar fechas, agregar o quitar (las quitadas se marcan, no se borran), y "Avanzar a la siguiente fase".
- Cuando la fase **"Reintegro"** queda en curso, el jugador pasa a disponibilidad **Reintegro**.
- El jugador aparece en **"Lesiones activas"** con su tiempo de regreso. Su ficha (`/jugadores/[id]`) muestra foto, lesión actual, avance, fases y una línea de tiempo con todas sus lesiones.
- La disponibilidad también se puede cambiar a mano desde el plantel.

**5. Alta**
- "Dar de alta" cierra la lesión y el jugador vuelve a **Disponible** si no tiene otra lesión abierta.

**Estados**
- Disponibilidad del jugador: Disponible, En revisión (solo al marcarlo lesionado), Lesionado y Reintegro. "Lesiones activas" = jugadores Lesionado o Reintegro.
- Lesión: En evaluación, Activa, Cerrada, Descartada.
- Fase: Pendiente, En curso, Completada.

**6. Nóminas y carga del plantel** (migraciones 0027 y 0028)
- **Nóminas** (todos los confirmados: sidebar en escritorio y barra o "Más" en el celular): las nóminas de cada partido y un botón grande **"Armar nómina"** que lleva al próximo partido (si no hay, avisa y ofrece crearlo). También se llega desde el detalle del partido en el calendario ("Armar nómina") y desde el ícono junto al próximo partido en el Resumen.
- **Convocatoria por puestos** (0029): en lista se convoca con casillas; en la cancha cada puesto titular (en rugby, 1 a 15) y de banca (16 a 23, al costado de la cancha) se asigna a un jugador, con filtro "Solo disponibles". Titulares y banca por deporte están en la tabla `sports`. Se ve la disponibilidad de cada jugador y se puede convocar a un no disponible, con aviso. Quitar a alguien lo archiva (no se borra).
- **Participación:** cuando el partido ya empezó, el botón pasa a **"Cargar participación"**: lista de convocados con un control según el modo del club y un solo guardado.
- **Modo por club** (Configuración, dirección): minutos exactos, rango de minutos (5 niveles que dependen del deporte) o jugó / no jugó. Por defecto, rango. Lo ya cargado se conserva; las métricas usan el modo actual y no estiman hacia arriba un dato menos detallado ("N partidos cargados en otro modo").
- **Escala por deporte:** duración, tope y cortes de los rangos viven en la tabla `sports` (una sola fuente de verdad).
- **Métricas → "Carga del plantel"** (staff): resumen (cuántos con carga alta y cuántos sin minutos o sin partidos) y los primeros 5 del ranking, con mini barras de los últimos 4 partidos y semáforo (con 3 partidos o más); "Ver ranking completo" abre `/metricas/carga`.
- **Ficha del jugador → "Carga"** (staff): últimos 6 partidos, carga de la ventana, comparación con el promedio del plantel y última lesión.
- **Jugador:** en su Resumen, "Mi carga" (sin semáforo) y "Mis partidos"; también ve su propia ficha. En Nóminas ve cada nómina en lectura (`/nominas/[eventId]`, 0048): titulares, banca y convocados sin puesto, sin disponibilidad ni minutos. Nunca la carga ni los minutos de otros jugadores.

**7. Calendario**
- Las competencias solo piden hora de inicio; los entrenamientos, inicio y término.
- Celular: cambiar entre Semana y Mes, y entre semanas del mes cargado, es inmediato (sin ir al servidor; la URL se actualiza con `replaceState`). Solo cambiar de mes pide datos nuevos.

**7b. Asistencia a entrenamientos** (20261105120000)
- **Pasar lista** (cualquier staff): en el detalle de un entrenamiento, botón "Pasar lista", habilitado desde que empieza y si no está cancelado. Pantalla `/calendario/[id]/asistencia`: contadores Presentes / Ausentes, todos parten presentes y se toca a quien faltó (chip Presente/Ausente), insignia "Lesionado" solo informativa y "Guardar asistencia". Si ya hay lista, se precarga y se corrige. En Sevens, la lista es el grupo.
- Entrenamientos ya empezados sin lista: etiqueta **"Asistencia sin registrar"** en el detalle y en la lista semanal del celular (solo staff).
- **Resumen → "Asistencia a entrenamientos"** (métrica opcional `asistencia`; el head coach la activa en Configuración, computador o celular): top 5 del último mes con puesto, barra, % y asistidos/total, y "Ver asistencia completa". La ven todos los confirmados, también los jugadores.
- **`/asistencia`** (todos los confirmados; no está en el menú ni en la barra): ranking del plantel con "Último mes" (30 días) / "Temporada" (desde el 1 de enero); barra verde desde 85 %, ámbar 70–84 % y roja bajo 70 %; el jugador ve su fila resaltada. Solo cuentan entrenamientos con lista guardada.

**7c. sRPE y check de bienestar** (20261105180000, 20261105190000). En la interfaz nunca "riesgo de lesión": "Carga alta" y "Bajo lo habitual".
- **sRPE:** después de cada entrenamiento o partido, el jugador responde "¿Qué tan duro fue?" (0–10; 0 Reposo, 1 Muy fácil, 2 Fácil, 3 Moderado, 4 Algo duro, 5–6 Duro, 7–8 Muy duro, 9 Casi máximo, 10 Máximo; textos y colores en `RPE_SCALE` de `src/lib/srpe.ts`). Carga = esfuerzo × minutos. Se responde desde que empieza hasta 48 h después del término y se puede corregir en ese plazo. No aparece si el evento está cancelado, si figura ausente en la lista, si no fue convocado al partido o (en Sevens) si no está en el grupo. "No fui a este entrenamiento" / "No jugué este partido" queda como respuesta sin esfuerzo.
- **Minutos** (se calculan al leer, no se guardan): entrenamiento = término − inicio; partido en minutos exactos = los cargados; no jugó = 0; rango, jugó / no jugó o sin participación cargada = la duración del partido del formato, marcada "estimada".
- **Check de bienestar:** fatiga, calidad del sueño, dolor muscular, estrés y ánimo, de 1 a 5 (5 = mejor siempre), total sobre 25. Se responde los días que eligen el head coach, el manager o el preparador físico en Configuración → "Check de bienestar" (por defecto, lunes) o al día siguiente; se corrige el mismo día.
- **Jugador:** en el Resumen, bloque "Pendientes" arriba (tarjetas "¿Qué tan duro fue el entrenamiento/partido?" con fecha, hora y duración, y "Check de bienestar"; sin pendientes no aparece) y "Mi bienestar" (último total / 25) junto a "Mi carga". Pantallas `/reportar/[eventId]` ("número grande": círculo de 210 px con el número, su etiqueta y una frase, color de gris a celeste y naranjo; − y + de 64 px y barra de 11 segmentos tocables; al entrar sin respuesta muestra "?" y "Guardar" queda deshabilitado; pie fijo con la carga en vivo "7 × 90 min = 630", "Guardar" y "No fui…"/"No jugué…"; sin barra inferior y cabe en 390×844 sin scroll; componente `src/app/effort-screen.tsx` y `effort-picker.tsx`) y `/bienestar` (chips 1–5, "N de 5 respondidas", total y "Enviar").
- **Staff:** en el detalle del evento, botón "Reportes" desde que empieza → `/calendario/[id]/reportes`: respondieron X de Y con barra, esfuerzo y carga promedio, "Sin responder (N)", "Dijo que no fue" y "Bienestar bajo lo habitual" (solo jugadores de ese evento). Ficha del jugador: "Carga" (6 semanas en barras, la actual en naranjo si es "Carga alta", línea punteada del promedio de 4 semanas, "+X % sobre su promedio" y sesiones de la semana) y "Bienestar" (últimos 6 checks con los 5 ítems); los minutos de partidos siguen debajo ("Minutos en partidos"). Métricas → "Carga del plantel": tarjeta "Carga sRPE" con cuántos tienen "Carga alta" esta semana y cuántos están "Bajo lo habitual", con link a cada ficha.
- **Avisos (provisorios):** "Carga alta" = semana actual (lunes a domingo, Chile) > 1,3 × promedio de las 4 semanas anteriores con datos, con al menos 3. "Bajo lo habitual" = último check de los últimos 7 días ≤ promedio de sus 4 anteriores − 4 (con al menos 3) o algún ítem en 1; los ítems con 1 o 2 se nombran.
- Todo sigue el formato activo (Rugby 15 o Sevens).

**7d. Plan de gimnasio** (20261105200000–202000). El gimnasio no tiene formato: cuenta en Rugby 15 y en Sevens.
- **Planes** (head coach y preparador físico; "Planes de gimnasio" en la sidebar y en "Más"): `/planes` lista borradores, publicados y archivados con vigencia, días, a quién va, cuántos lo reciben y % cumplido. `/planes/nuevo` y `/planes/[id]`: arriba, "¿Qué vas a planificar?" con Diaria (por defecto: un entrenamiento, una fecha, sin pestañas; la sesión toma el nombre del plan), Semanal (fecha de inicio y 7 días, sesiones por día) o Mensual (desde y hasta, por defecto 4 semanas; la semana tipo se repite). Es solo del editor: al abrir un plan se deduce de sus fechas y sesiones. Luego nombre, "Asignar a" (Todo el plantel, Delanteros y Backs en rugby como atajos de sus posiciones, Posiciones…, Jugadores… y Sevens si aplica; la posición es la principal del jugador), vigencia, días, sesiones en pestañas ("+ Sesión") con su tabla de ejercicios (código A, B1, B2…, Ejercicio con autocompletado de los ya usados, Series, Reps, Intensidad: % máx, Esfuerzo, Kilos, Corporal o Tiempo en m:ss, Descanso, Nota). "+ Bloque" agrupa ejercicios bajo un nombre editable (el primero convierte los que había en "Bloque 1"; cada bloque tiene "+ Ejercicio" y quitar); el ícono de cadena une un ejercicio con el siguiente del mismo bloque en superserie (mismo código con número y barra celeste) y, a la derecha, "Vista previa: así lo ve [jugador]" con kilos, "Lesionados (N)" (por defecto reciben el plan; "Descartar a todos" y "Descartar a…") y el aviso "N sin test de [test]". En el celular, tarjetas por bloque (las superseries van pegadas) y una hoja con series y reps o tiempo (+/−), "Hacer superserie con el siguiente", intensidad en 5 opciones y, con % máx, porcentaje de a 5, test y un cálculo de ejemplo. Un plan publicado se edita ("Guardar cambios") y se puede archivar.
- **Intensidad:** % del máximo de un test en kilos de Evaluaciones (kilos = último resultado no anulado × % redondeado a 2,5 kg; sin test, "80 % de tu máximo"), esfuerzo 1–10, kilos fijos o peso corporal.
- **Jugador:** en el Resumen, tarjeta celeste "Hoy toca gimnasio" si tiene una sesión sin hacer hoy y el link "¿Fuiste al gimnasio por tu cuenta? Regístralo". `/mi-plan` ("Mi plan" en la barra): barra "N de M ejercicios hechos", tarjetas por bloque que se marcan al tocarlas, con su código (A, B1…), los kilos o el tiempo a la derecha y el aviso "Superserie: hazlos seguidos, descansa al final", "Terminar sesión" y "Hice la sesión completa"; si hay sesiones pendientes de los 2 días anteriores, chips para elegirlas; sin sesión, la próxima. Al terminar, `/mi-plan/listo/[logId]` a pantalla completa (celeste): "¡Felicidades, [nombre]!", ejercicios, sesiones de la semana y semanas seguidas cumpliendo, con "¿Qué tan dura fue la sesión?" (`/mi-plan/esfuerzo/[logId]`, la misma pantalla de `/reportar`, sin link de "No hice esta sesión") y "Volver al inicio". `/mi-plan/propia`: fecha (hoy, ayer o anteayer), duración, esfuerzo opcional (el mismo selector de número grande) y nota. Las sesiones sin esfuerzo aparecen en "Pendientes".
- **Plazo:** marcar la sesión y responder el esfuerzo, el día de la sesión y hasta 2 días después; se corrige en ese plazo. Minutos de una sesión del plan = su duración estimada.
- **Mi semana** (Resumen, todos los confirmados): 7 días L a D con G, E o P (letras juntas si hay varias; "·" si nada), hoy en #082F49, leyenda y detalle al tocar un día. Jugador: eventos del formato activo y sus sesiones del plan; staff: eventos del club y los días con algún plan publicado.
- **Staff:** ficha → "Carga" con barras apiladas (Cancha #7DD3FC, Gimnasio #0369A1, Partido #F97316), leyenda y "El gimnasio es el X % de su carga" (6 semanas); ficha → "Gimnasio": plan asignado, cumplimiento de 6 semanas y últimas sesiones. Métricas → "Carga del plantel": "Carga por jugador" con barra apilada, total, vs su promedio y "Plan de gimnasio" ("2 de 2"; incompleto en gris), y "Plan de gimnasio cumplido: X %" (hechas / las que ya tocaban esta semana).

**8. Evaluaciones físicas** (0044)
- **Evaluaciones** (staff menos el manager; sidebar y "Más"): "Cargar resultados" (test, fecha no futura, valor anterior por jugador, "Guardar N resultados"; un resultado del día se anula y se vuelve a cargar) y "Comparar plantel" (ranking por test con barra y cambio con flecha y texto "mejor" o "peor").
- Catálogo por plantel: "Agregar tests sugeridos" (7 tests; Bronco en mm:ss guardado en segundos) y tests propios que se pueden archivar.
- **Jugador:** "Mis evaluaciones" desde el Resumen: último resultado, puesto, gráfico de progreso y ranking del plantel con su fila resaltada. La ficha del jugador muestra el mismo gráfico al staff.

**9. Rugby Sevens** (0045)
- No es un deporte ni un club nuevo: un grupo con formato dentro del mismo plantel de rugby (mismas fichas, lesiones, disponibilidad y evaluaciones).
- La dirección activa Sevens (`set_club_sevens`, solo rugby) y arma el grupo con jugadores y staff (`set_sevens_group`). Cada miembro elige su posición de Sevens (`set_my_sevens_position`): Pilar, Hooker, Medio scrum, Apertura, Centro o Wing (`positions.format = '7'`).
- Los eventos tienen formato (`events.format`). En Sevens, la nómina admite los puestos 1 a 12 (7 titulares y 5 de banca) y la participación usa 14 minutos con tope 14 y rangos 0 / 1–4 / 5–9 / 10–13 / 14 (provisorio, en `sport_format_config`). La carga se calcula por formato (`team_match_load(n, formato)`, `my_match_load(formato)`).
- Formato activo: cookie `recov_format` (`src/lib/format.ts`, `getActiveFormat`). Es '7' solo si el plantel tiene Sevens y la cuenta está en el grupo o es de la dirección; al cambiar de plantel vuelve a '15'.
- El selector "Rugby 15 | Sevens" va solo arriba del Resumen.
- En Sevens: Plantel, Lesiones activas del Resumen y las listas de jugadores muestran solo el grupo. El Plantel muestra la posición de Sevens con chips por posición. Calendario, Nóminas, Métricas, Carga y la ficha usan solo eventos del formato; los eventos nuevos nacen en el formato activo. "Por revisar" del Resumen y la pantalla Lesiones muestran solo las lesiones del grupo; el detalle de cada lesión, documentos, fases y evaluaciones no se separan.
- Los jugadores del grupo sin posición de Sevens ven el aviso "Elige tu posición en Sevens" en el Resumen y el Plantel (el staff no).
- Métricas del Resumen y de Métricas por formato (0046): en Sevens, solo el grupo y su posición de Sevens.
- El selector cambia todo de una vez. Para quien tiene los dos formatos, el encabezado de cada pantalla muestra "Rugby 15" o "Sevens".
- Cancha de Sevens horizontal, como la imagen de referencia (1 y 3 arriba, 2 entre ellos, 4 a 7 en diagonal), en el Plantel y en la nómina (banca 8 a 12 en una franja debajo). La nómina sigue el formato del evento (`src/lib/pitch.ts`, tipo `sevens`).
- Configuración (dirección, solo rugby): "Activar Sevens" y la pantalla `/configuracion/sevens` (Grupo Sevens: casillas y "Guardar grupo"). El registro por `/c/[slug]` no cambia: siempre entra al 15.

**10. Navegación móvil** (solo celular; en escritorio sigue la sidebar)
- Barra inferior: 4 pestañas configurables y "Más" fijo a la derecha. El jugador tiene 3 y, al centro, el botón fijo "Registrar lesión" (`src/app/mobile-nav.tsx`).
- Pantallas que se pueden elegir según el rol (`src/lib/nav-slots.ts`, la misma regla que `set_nav_slots`): Resumen, Calendario y Plantel (todos); Nóminas (todos, desde 0048); Lesiones y Métricas (staff); Evaluaciones (quienes ven resultados); Registros y Staff (dirección); Mis lesiones y Mis evaluaciones (jugador).
- Por defecto: head coach Resumen, Calendario, Plantel, Lesiones; manager Resumen, Calendario, Plantel, Nóminas; kine, delegado y entrenador Resumen, Calendario, Lesiones, Plantel; preparador físico y nutricionista Resumen, Calendario, Evaluaciones, Plantel; jugador Resumen, Calendario, Mi plan ("Mis lesiones" pasó a "Más"; a quien ya guardó su barra no se le cambia).
- "Más": hoja flotante con las pantallas del rol que no están en la barra (grilla de 3), punto rojo en Registros si hay pendientes, Configuración para el head coach, el manager y el preparador físico, y abajo "Perfil" y "Cerrar sesión".
- Perfil → "Barra principal" (solo celular): elegir las pestañas, "Guardar" y "Restablecer" (vuelve al valor por defecto del rol). Si cambian los roles y lo guardado ya no vale, se usa el valor por defecto.

## Funciones por rol

**Todos los roles**
- Registrarse por el link del plantel, con foto opcional, o unirse a otro plantel con la misma cuenta. Los roles son por plantel.
- Ver el ranking de cada test del plantel (sin notas).
- Ver el plantel con la disponibilidad, la foto y la fase en curso de cada jugador (solo el nombre de la fase).
- Elegir las pestañas de la barra inferior del celular (Perfil → "Barra principal"), solo entre las pantallas de su rol.
- Ver el ranking de asistencia a entrenamientos (`/asistencia`) y, si el head coach la activó, su tarjeta en el Resumen.

**Jugador**
- Responder el esfuerzo de cada entrenamiento o partido (hasta 48 h después) y el check de bienestar; ver "Mi bienestar" y solo sus propios reportes.
- Registrar su propia lesión por zona y lado, con documentos opcionales.
- Completar el diagnóstico de una lesión en evaluación.
- Reemplazar o eliminar sus documentos mientras el kine no revisa la lesión.
- Ver sus lesiones, documentos y fases ("Mis lesiones").
- Ver sus evaluaciones, con notas, y su progreso ("Mis evaluaciones").
- Ver la nómina de cada partido en lectura (quién va, titular o banca y su puesto), desde Nóminas.
- No ve lesiones, fechas ni documentos de otros jugadores.

**Kinesiólogo y su delegado** (la persona del staff en quien el head coach delegó las funciones de kinesiólogo)
- Todo lo del staff, más:
- Ver documentos médicos y el indicador "Sin documento".
- Cambiar la disponibilidad a mano.
- Marcar lesionado desde el plantel.
- Bandeja "Por revisar": confirmar, descartar y dar de alta.
- Cargar, editar y avanzar fases.

**Head coach**
- Todo lo del kinesiólogo, más lo de la dirección:
- Confirmar o rechazar registros (`/registros`).
- Gestionar el staff en `/staff`: cambiar roles, quitar a alguien del staff y delegar las funciones de kinesiólogo.

**Manager**
- Todo lo del staff, más lo de la dirección: registros y gestión del staff.
- No gestiona lesiones ni ve documentos médicos.

**Evaluaciones**
- Registrar resultados, anularlos y administrar el catálogo: head coach, kinesiólogo y preparador físico.
- Ver los resultados de todo el plantel: además, entrenador y nutricionista. El manager no.

**Nóminas** (head coach, manager y el delegado de nóminas que la dirección asigna en `/staff`)
- Armar la convocatoria de cada partido y cargar la participación de los convocados.
- El resto del staff ve la carga del plantel; el jugador solo la suya. Todos los confirmados ven las nóminas (0048).

**sRPE y bienestar**
- Todo el staff confirmado: ver los reportes de cada evento, la carga semanal y el bienestar en la ficha, y la tarjeta "Carga sRPE" de Métricas.
- Elegir los días del check de bienestar: head coach, manager y preparador físico, en Configuración. El preparador físico entra a Configuración solo para eso (ve solo esa sección).

**Plan de gimnasio**
- Crear, editar, publicar y archivar planes: head coach y preparador físico. El resto del staff ve la carga con el gimnasio, la ficha → "Gimnasio" y el cumplimiento en Métricas.
- Jugador: ve solo su plan (por funciones, sin leer las tablas de planes), marca sus sesiones, registra las propias y su esfuerzo; ve solo sus registros.

**Entrenador, nutricionista y preparador físico** (staff)
- Ver "Lesiones activas" y la ficha de cada jugador.
- Pasar lista en los entrenamientos (como todo el staff).
- Ver el detalle de cualquier lesión del club (sin documentos) y sus fases.
- No pueden modificar nada.

Todos estos permisos los exige la base de datos (RLS y funciones `SECURITY DEFINER` con permisos explícitos), no solo la interfaz.

## Seguridad
- **Sesión en las páginas:** `getSessionUser` usa `getClaims` (verifica la firma ES256 del JWT sin ir a Auth). Las acciones que escriben siguen usando `getUser`.
- **Plantel:** `club_members` es la única fuente de plantel, roles y estado; `profiles` solo guarda identidad (0043). RLS usa el `club_id` de cada fila; las funciones toman el plantel activo del header `x-club-id`, validado contra las membresías (inválido o ajeno: sin permisos).
- **App:** las listas filtran por el plantel activo (RLS devuelve las filas de todos los planteles de la cuenta). La clave de servicio solo se usa en el servidor (correos y recuperación de contraseña).
- **Correos de Auth:** máximo 1 por minuto y 5 por hora por correo (`allow_auth_email`, se guarda el hash del correo).
- **Avisos de Supabase intencionales:** funciones `SECURITY DEFINER` ejecutables por `authenticated`; `club_public_info`, `club_public_card` y `club_logo_path` para anon (link sin sesión); tablas privadas con RLS y sin políticas.
- **Avisos abiertos:** "Leaked password protection" desactivado; `pg_net` en el esquema `public` (sin uso).

## Pendiente
- **Sevens:**
  - la escala de Sevens es provisoria (fila `rugby`/`7` de `sport_format_config`);
  - solo cuentas pueden estar en el grupo (`sevens_group.member_id` = `club_members.user_id`): un jugador sin cuenta no entra.
- **Seguridad:** activar "Leaked password protection" en Supabase Auth (desde el panel).
- **Base de datos:**
  - anotar la 0043 en `supabase_migrations.schema_migrations`;
  - 0049: borrar `private.profiles_legacy_backup` una semana después de aplicar la 0043 (desde ~1 nov);
  - quedan sin uso `pg_net`, `private.member_emails`, `profiles.email_verified_at`, `private.email_verification_tokens`, `create_email_verification` y `verify_email`.
- **Datos de demo:** hc.demo sigue como head coach confirmado en Demo - Fútbol; no hay cuentas demo de preparador físico ni de nutricionista.
- **Rendimiento:**
  - el proxy consulta `club_members` en cada request (también en cada prefetch) para validar el plantel activo: un viaje a Supabase antes de cada pantalla;
  - al cambiar formato o plantel, Next vuelve a pedir el prefetch de todos los links visibles (~24 pedidos de fondo);
  - el selector de plantel (`club-header.tsx`) sigue llamando a `router.refresh()` después de `setActiveClub`, que ya cambia la cookie (pide la página dos veces);
  - la carga del jugador en el Resumen (`getMyLoad`) y `/lesiones` en Sevens (`formatPlayerIds`) siguen encadenando consultas.
- **Asistencia:**
  - fuera de este PR: motivo de ausencia, auto-registro del jugador y carga acumulada combinada (asistencia + partidos);
  - el ranking no separa formatos: en Sevens muestra todo el plantel y suma entrenamientos de 15 y de 7;
  - "Temporada" = desde el 1 de enero del año en curso (confirmar si el club usa otra definición).
- **sRPE y bienestar:**
  - umbrales provisorios: "Carga alta" con 1,3 × el promedio de 4 semanas (`private.srpe_high_load_ratio()`) y "Bajo lo habitual" con −4 puntos (`private.wellness_drop()`); ajustarlos con datos reales;
  - sin botón "Recordar" ni notificaciones a quienes no respondieron;
  - la carga de partido es estimada (duración completa del partido) en modos rango y jugó / no jugó, y cuando no hay participación cargada;
  - la semana actual (aún en curso) se compara con semanas completas: a comienzo de semana la carga parte baja;
  - "Mi carga" del jugador sigue siendo de minutos en partidos; aún no ve su carga sRPE semanal (con gimnasio).
  - el esfuerzo del gimnasio no tiene "No hice esta sesión": la sesión ya quedó marcada y no hay función para deshacerla.
- **Plan de gimnasio:**
  - el autocompletado de ejercicios usa los nombres ya escritos en el plantel: no hay biblioteca de ejercicios;
  - el gimnasio no tiene formato: en Sevens cuenta igual y el % cumplido de Métricas incluye a todo el plantel;
  - "Delanteros" y "Backs" solo existen en rugby y miran la posición principal (no la secundaria);
  - en el editor, los destinatarios por posición se guardan por posición: un jugador que cambia de posición entra o sale del plan;
  - un plan editado cambia las asignaciones de días ya pasados (el cumplimiento se recalcula con el plan actual);
  - la ficha muestra "Gimnasio" como una sección más (la ficha no tiene pestañas);
  - sin aviso ni notificación al publicar un plan.
- **Limpieza:** borrar las ramas viejas ya mergeadas, en local y en GitHub.
- **Funciones aún sin pantalla:**
  - Que el kine registre una lesión desde cero, sin marcarla primero.
  - Revisar documentos (pasar de borrador a revisado).
- **Registro de lesión v2:**
  - en celular el codo mide ~26 × 22 px y la rodilla ~28 × 32 px (la lista es la alternativa); revisar en iPhone;
  - el detalle de la ficha del jugador (`/jugadores/[id]`) aún muestra el tipo, sin el mapa;
  - un archivo subido a Storage en un intento de registro que falla y no se reintenta queda sin fila en `documents` (como antes).
- **Fase "Reintegro":** el cambio automático depende de que la fase se llame exactamente "Reintegro"; si se renombra, deja de funcionar.

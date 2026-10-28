# Recov: estado actual de la plataforma (26 oct 2026)

Plataforma web de seguimiento de lesiones para clubes deportivos amateur (7 deportes: fútbol, futsal, rugby, handball, vóleibol, básquetbol, hockey césped; cada club tiene uno, fijado al crearlo). Proyecto del Taller de Emprendimiento Tecnológico y Sostenibilidad (UAI). Interfaz en español; pruebas y demos solo con datos ficticios. Primer plantel real: Old Locks M16 (25 oct).

**Stack:** Next.js 16 (App Router; `middleware` se llama `proxy.ts`) + Supabase (Auth, Postgres con RLS, Storage) + Vercel. Supabase se maneja por MCP (proyecto "Recov").

## Estado del repositorio
- Todo está mergeado en `main` (último: PR #79, 26 oct), salvo #80 (Sevens, base de datos).
- Migraciones 0001 a 0045 aplicadas en Supabase (por MCP o, cuando el MCP rechaza `DROP`, por el SQL Editor). 0043 se aplicó desde el SQL Editor y falta anotarla en `supabase_migrations.schema_migrations`.
- 28 pantallas (rutas de página en `src/app`).
- 0016: 7 deportes y 44 posiciones (en rugby, "Ala" pasó a "Flanker"; hockey reemplazó su catálogo). El trigger `players_validate_position` valida que `players.position` y `secondary_position` existan en `positions` del deporte del club, también en inserts y updates directos.
- Tests (terminan en ROLLBACK, todos pasan): `supabase/tests/rls_isolation_test.sql` (aislamiento y permisos), `injury_lifecycle_test.sql` (ciclo de la lesión y fases), `events_test.sql` (calendario), `match_load_test.sql` (nóminas y carga), `evaluaciones_test.sql` (evaluaciones) y `sevens_test.sql` (Rugby Sevens).
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

## Historial
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
- **A. El kine la ve en terreno:** en el plantel pulsa "Marcar lesionado" junto al jugador e indica dónde ocurrió (entrenamiento o competencia) y una nota breve. La lesión queda **En evaluación** y el jugador **En revisión**. Al jugador le aparece una tarjeta para subir su diagnóstico (tipo, duración que indicó el médico, 1 a 5 documentos). Al subirlo, la lesión pasa a **Activa, sin revisar**.
- **B. El jugador la reporta por su cuenta** ("Registrar lesión", con fecha, diagnóstico y documentos). Queda **Activa, sin revisar**.

**3. Revisión**
- La lesión aparece en la bandeja **"Por revisar"** del kine, su delegado y el head coach.
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
- **Nóminas** (sidebar y "Más" en el celular, staff): las nóminas de cada partido y un botón grande **"Armar nómina"** que lleva al próximo partido (si no hay, avisa y ofrece crearlo). También se llega desde el detalle del partido en el calendario ("Armar nómina") y desde el ícono junto al próximo partido en el Resumen.
- **Convocatoria por puestos** (0029): en lista se convoca con casillas; en la cancha cada puesto titular (en rugby, 1 a 15) y de banca (16 a 23, al costado de la cancha) se asigna a un jugador, con filtro "Solo disponibles". Titulares y banca por deporte están en la tabla `sports`. Se ve la disponibilidad de cada jugador y se puede convocar a un no disponible, con aviso. Quitar a alguien lo archiva (no se borra).
- **Participación:** cuando el partido ya empezó, el botón pasa a **"Cargar participación"**: lista de convocados con un control según el modo del club y un solo guardado.
- **Modo por club** (Configuración, dirección): minutos exactos, rango de minutos (5 niveles que dependen del deporte) o jugó / no jugó. Por defecto, rango. Lo ya cargado se conserva; las métricas usan el modo actual y no estiman hacia arriba un dato menos detallado ("N partidos cargados en otro modo").
- **Escala por deporte:** duración, tope y cortes de los rangos viven en la tabla `sports` (una sola fuente de verdad).
- **Métricas → "Carga del plantel"** (staff): resumen (cuántos con carga alta y cuántos sin minutos o sin partidos) y los primeros 5 del ranking, con mini barras de los últimos 4 partidos y semáforo (con 3 partidos o más); "Ver ranking completo" abre `/metricas/carga`.
- **Ficha del jugador → "Carga"** (staff): últimos 6 partidos, carga de la ventana, comparación con el promedio del plantel y última lesión.
- **Jugador:** en su Resumen, "Mi carga" (sin semáforo) y "Mis partidos"; también ve su propia ficha. Nunca datos de otros jugadores.

**7. Calendario**
- Las competencias solo piden hora de inicio; los entrenamientos, inicio y término.

**8. Evaluaciones físicas** (0044)
- **Evaluaciones** (staff menos el manager; sidebar y "Más"): "Cargar resultados" (test, fecha no futura, valor anterior por jugador, "Guardar N resultados"; un resultado del día se anula y se vuelve a cargar) y "Comparar plantel" (ranking por test con barra y cambio con flecha y texto "mejor" o "peor").
- Catálogo por plantel: "Agregar tests sugeridos" (7 tests; Bronco en mm:ss guardado en segundos) y tests propios que se pueden archivar.
- **Jugador:** "Mis evaluaciones" desde el Resumen: último resultado, puesto, gráfico de progreso y ranking del plantel con su fila resaltada. La ficha del jugador muestra el mismo gráfico al staff.

**9. Rugby Sevens** (0045; por ahora solo base de datos, la app llega en el PR siguiente)
- No es un deporte ni un club nuevo: un grupo con formato dentro del mismo plantel de rugby (mismas fichas, lesiones, disponibilidad y evaluaciones).
- La dirección activa Sevens (`set_club_sevens`, solo rugby) y arma el grupo con jugadores y staff (`set_sevens_group`). Cada miembro elige su posición de Sevens (`set_my_sevens_position`): Pilar, Hooker, Medio scrum, Apertura, Centro o Wing (`positions.format = '7'`).
- Los eventos tienen formato (`events.format`). En Sevens, la nómina admite los puestos 1 a 12 (7 titulares y 5 de banca) y la participación usa 14 minutos con tope 14 y rangos 0 / 1–4 / 5–9 / 10–13 / 14 (provisorio, en `sport_format_config`). La carga se calcula por formato (`team_match_load(n, formato)`, `my_match_load(formato)`).

## Funciones por rol

**Todos los roles**
- Registrarse por el link del plantel, con foto opcional, o unirse a otro plantel con la misma cuenta. Los roles son por plantel.
- Ver el ranking de cada test del plantel (sin notas).
- Ver el plantel con la disponibilidad, la foto y la fase en curso de cada jugador (solo el nombre de la fase).

**Jugador**
- Registrar su propia lesión con documentos.
- Completar el diagnóstico de una lesión en evaluación.
- Ver sus lesiones, documentos y fases ("Mis lesiones").
- Ver sus evaluaciones, con notas, y su progreso ("Mis evaluaciones").
- No ve lesiones, fechas ni documentos de otros jugadores.

**Kinesiólogo y su delegado** (la persona del staff en quien el head coach delegó las funciones de kinesiólogo)
- Todo lo del staff, más:
- Ver documentos médicos.
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
- El resto del staff ve la carga del plantel; el jugador solo la suya.

**Entrenador, nutricionista y preparador físico** (staff)
- Ver "Lesiones activas" y la ficha de cada jugador.
- Ver el detalle de cualquier lesión del club (sin documentos) y sus fases.
- No pueden modificar nada.

Todos estos permisos los exige la base de datos (RLS y funciones `SECURITY DEFINER` con permisos explícitos), no solo la interfaz.

## Seguridad
- **Plantel:** `club_members` es la única fuente de plantel, roles y estado; `profiles` solo guarda identidad (0043). RLS usa el `club_id` de cada fila; las funciones toman el plantel activo del header `x-club-id`, validado contra las membresías (inválido o ajeno: sin permisos).
- **App:** las listas filtran por el plantel activo (RLS devuelve las filas de todos los planteles de la cuenta). La clave de servicio solo se usa en el servidor (correos y recuperación de contraseña).
- **Correos de Auth:** máximo 1 por minuto y 5 por hora por correo (`allow_auth_email`, se guarda el hash del correo).
- **Avisos de Supabase intencionales:** funciones `SECURITY DEFINER` ejecutables por `authenticated`; `club_public_info`, `club_public_card` y `club_logo_path` para anon (link sin sesión); tablas privadas con RLS y sin políticas.
- **Avisos abiertos:** "Leaked password protection" desactivado; `pg_net` en el esquema `public` (sin uso).

## Pendiente
- **Sevens:**
  - PR 2 (app): formato activo, selector en el Resumen, filtros por formato, nómina Sevens y pantallas de la dirección;
  - la escala de Sevens es provisoria (fila `rugby`/`7` de `sport_format_config`);
  - solo cuentas pueden estar en el grupo (`sevens_group.member_id` = `club_members.user_id`): un jugador sin cuenta no entra.
- **Seguridad:** activar "Leaked password protection" en Supabase Auth (desde el panel).
- **Base de datos:**
  - anotar la 0043 en `supabase_migrations.schema_migrations`;
  - 0046: borrar `private.profiles_legacy_backup` una semana después de aplicar la 0043 (desde ~1 nov);
  - quedan sin uso `pg_net`, `private.member_emails`, `profiles.email_verified_at`, `private.email_verification_tokens`, `create_email_verification` y `verify_email`.
- **Datos de demo:** hc.demo sigue como head coach confirmado en Demo - Fútbol; no hay cuentas demo de preparador físico ni de nutricionista.
- **Limpieza:** borrar las ramas viejas ya mergeadas, en local y en GitHub.
- **Funciones aún sin pantalla:**
  - Que el kine registre una lesión desde cero, sin marcarla primero.
  - Revisar documentos (pasar de borrador a revisado).
- **Fase "Reintegro":** el cambio automático depende de que la fase se llame exactamente "Reintegro"; si se renombra, deja de funcionar.

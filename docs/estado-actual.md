# Recov: estado actual de la plataforma (12 oct 2026)

Plataforma web de seguimiento de lesiones para clubes deportivos amateur (7 deportes: fútbol, futsal, rugby, handball, vóleibol, básquetbol, hockey césped; cada club tiene uno, fijado al crearlo). Proyecto del Taller de Emprendimiento Tecnológico y Sostenibilidad (UAI). Interfaz en español, solo datos ficticios.

**Stack:** Next.js 16 (App Router; `middleware` se llama `proxy.ts`) + Supabase (Auth, Postgres con RLS, Storage) + Vercel. Supabase se maneja por MCP (proyecto "Recov").

## Estado del repositorio
- Todo está mergeado en `main` (último: PR #11). No hay ramas con trabajo pendiente.
- Migraciones 0001 a 0016 aplicadas en Supabase. 0007 a 0015 se aplicaron por MCP; 0001 a 0006 y 0016, por el SQL Editor.
- 0016: 7 deportes y 44 posiciones (en rugby, "Ala" pasó a "Flanker"; hockey reemplazó su catálogo). El trigger `players_validate_position` valida que `players.position` y `secondary_position` existan en `positions` del deporte del club, también en inserts y updates directos.
- Tests (terminan en ROLLBACK, todos pasan): `supabase/tests/rls_isolation_test.sql` (aislamiento y permisos), `injury_lifecycle_test.sql` (ciclo de la lesión y fases), `events_test.sql` (calendario) y `match_load_test.sql` (nóminas y carga).
- 0027 y 0028 (20 oct 2026): nóminas, participación y carga del plantel.
- CLAUDE.md está al día con roles, flujo, estados, reglas y el flujo de trabajo de migraciones.

## Flujo de la plataforma

**1. Entrada al club**
- La persona se registra con el link del club (`/c/[slug]`) como jugador o staff, con foto de perfil opcional.
- Queda **pendiente** (pantalla `/pendiente`) hasta que la dirección la confirma o rechaza en `/registros`.

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
- **Convocatoria:** en el calendario, el detalle de un partido (evento de competencia) tiene el botón **"Nómina"**, que abre "Ver jugadores disponibles para esa fecha" con casillas para convocar. Se ve la disponibilidad de cada jugador y se puede convocar a un no disponible, con aviso. Quitar a alguien de la convocatoria lo archiva (no se borra).
- **Participación:** cuando el partido ya empezó, el botón pasa a **"Cargar participación"**: lista de convocados con un control según el modo del club y un solo guardado.
- **Modo por club** (Configuración, dirección): minutos exactos, rango de minutos (5 niveles que dependen del deporte) o jugó / no jugó. Por defecto, rango. Lo ya cargado se conserva; las métricas usan el modo actual y no estiman hacia arriba un dato menos detallado ("N partidos cargados en otro modo").
- **Escala por deporte:** duración, tope y cortes de los rangos viven en la tabla `sports` (una sola fuente de verdad).
- **Métricas → "Carga del plantel"** (staff): tarjetas de carga alta y sin minutos (o sin partidos), y ranking con mini barras de los últimos 4 partidos y semáforo (con 3 partidos o más).
- **Ficha del jugador → "Carga"** (staff): últimos 6 partidos, carga de la ventana, comparación con el promedio del plantel y última lesión.
- **Jugador:** en su Resumen, "Mi carga" (sin semáforo) y "Mis partidos"; también ve su propia ficha. Nunca datos de otros jugadores.

## Funciones por rol

**Todos los roles**
- Registrarse por link del club, con foto opcional.
- Ver el plantel con la disponibilidad, la foto y la fase en curso de cada jugador (solo el nombre de la fase).

**Jugador**
- Registrar su propia lesión con documentos.
- Completar el diagnóstico de una lesión en evaluación.
- Ver sus lesiones, documentos y fases ("Mis lesiones").
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

**Nóminas** (head coach, manager y el delegado de nóminas que la dirección asigna en `/staff`)
- Armar la convocatoria de cada partido y cargar la participación de los convocados.
- El resto del staff ve la carga del plantel; el jugador solo la suya.

**Entrenador, nutricionista y preparador físico** (staff)
- Ver "Lesiones activas" y la ficha de cada jugador.
- Ver el detalle de cualquier lesión del club (sin documentos) y sus fases.
- No pueden modificar nada.

Todos estos permisos los exige la base de datos (RLS y funciones `SECURITY DEFINER` con permisos explícitos), no solo la interfaz.

## Pendiente
- **Seguridad:** activar "Leaked password protection" en Supabase Auth (desde el panel). Es el único aviso de seguridad abierto que no es intencional.
- **Limpieza:** borrar las ramas viejas ya mergeadas, en local y en GitHub.
- **Funciones aún sin pantalla:**
  - Editar el perfil y cambiar la foto después del registro.
  - Que el kine registre una lesión desde cero, sin marcarla primero.
  - Revisar documentos (pasar de borrador a revisado).
- **Fase "Reintegro":** el cambio automático depende de que la fase se llame exactamente "Reintegro"; si se renombra, deja de funcionar.

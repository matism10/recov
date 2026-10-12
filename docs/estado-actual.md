# Recov: estado actual de la plataforma (12 oct 2026)

Plataforma web de seguimiento de lesiones para clubes deportivos amateur (rugby, hockey). Proyecto del Taller de Emprendimiento Tecnológico y Sostenibilidad (UAI). Interfaz en español, solo datos ficticios.

**Stack:** Next.js 16 (App Router; `middleware` se llama `proxy.ts`) + Supabase (Auth, Postgres con RLS, Storage) + Vercel. Supabase se maneja por MCP (proyecto "Recov").

## Estado del repositorio
- Todo está mergeado en `main` (último: PR #11). No hay ramas con trabajo pendiente.
- Migraciones 0001 a 0015 aplicadas en Supabase y presentes en `main`. 0007 a 0015 se aplicaron por MCP; 0001 a 0006, por el SQL Editor.
- Tests (terminan en ROLLBACK, ambos pasan): `supabase/tests/rls_isolation_test.sql` (aislamiento y permisos) e `injury_lifecycle_test.sql` (ciclo de la lesión y fases).
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

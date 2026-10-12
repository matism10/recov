@AGENTS.md
## Contexto de Recov

Recov es una plataforma web de seguimiento de lesiones para clubes deportivos amateur (rugby, hockey). Es un proyecto del Taller de Emprendimiento Tecnológico y Sostenibilidad (UAI). Su propuesta de valor es la simplicidad: una versión simple y barata de las plataformas pensadas para clubes profesionales, con una interfaz clara y atractiva. La interfaz va en español.

**Stack:** Next.js (App Router) + Supabase (Auth, Postgres con RLS, Storage) + Vercel.

**Roles:** `admin`, `kinesiologo`, `entrenador` y `jugador`. `profiles.roles` es un arreglo, así que una persona puede tener varios roles. El jugador tiene login y, por ahora, solo puede hacer dos cosas: subir su propia documentación médica (queda en borrador hasta que el kinesiólogo la revisa) y ver el estado de disponibilidad del plantel.

**Flujo central del MVP:** el jugador sube su documentación médica. El kinesiólogo la revisa y decide: (a) actualiza la disponibilidad directamente, o (b) registra una lesión y se genera una línea de tiempo de fases de recuperación. Ambos caminos terminan en el dashboard de disponibilidad del plantel (disponible, en recuperación, de baja), que consultan el entrenador y los jugadores.

### Reglas que no se rompen

- **Aislamiento por club:** toda tabla lleva `club_id` y la seguridad la define RLS en la base de datos, no el frontend. Nunca usar la service role key en código de cliente.
- **Datos de salud:** el jugador solo ve la disponibilidad del plantel, nunca lesiones ni documentos de otros. Los documentos médicos los revisa solo el kinesiólogo. El entrenador ve disponibilidad, lesiones y fases.
- **Cambios de base de datos:** el agente escribe y aplica las migraciones por el MCP de Supabase (proyecto "Recov"). Por cada cambio:
  1. Migración nueva en `supabase/migrations/` (siguiente número, ej. `0008_...`) y sus pruebas en `supabase/tests/rls_isolation_test.sql`.
  2. Aplicarla con `apply_migration`, con el mismo contenido del archivo.
  3. Correr el test con `execute_sql` (termina en `ROLLBACK`). Si hay un "FAIL", corregir con una migración nueva y avisar a Mati.
  4. Revisar `get_advisors` (seguridad) y avisar si aparece algo nuevo.
  Nunca editar una migración ya aplicada. Los cambios de enum (`alter type ... add value`) van en una migración propia. Preguntar a Mati antes de cualquier `DROP TABLE`, `TRUNCATE`, `DELETE` sobre datos o de hacer más permisiva una política RLS.
- **Datos:** solo datos ficticios. Nunca commitear `.env.local` ni claves.
- **Git:** trabajar en ramas y abrir pull request. `main` está protegida.
- **Next.js 16:** `middleware` ahora se llama `proxy.ts`. Antes de usar una API, leer `node_modules/next/dist/docs/`.
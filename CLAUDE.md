@AGENTS.md
## Contexto de Recov

Recov es una plataforma web de seguimiento de lesiones para clubes deportivos amateur (rugby, hockey). Es un proyecto del Taller de Emprendimiento Tecnológico y Sostenibilidad (UAI). Su propuesta de valor es la simplicidad: una versión simple y barata de las plataformas pensadas para clubes profesionales, con una interfaz clara y atractiva. La interfaz va en español.

**Stack:** Next.js (App Router) + Supabase (Auth, Postgres con RLS, Storage) + Vercel.

**Roles:** `admin`, `kinesiologo`, `entrenador` y `jugador`. `profiles.roles` es un arreglo, así que una persona puede tener varios roles. El jugador tiene login y, por ahora, solo puede hacer dos cosas: subir su propia documentación médica (queda en borrador hasta que el kinesiólogo la revisa) y ver el estado de disponibilidad del plantel.

**Flujo central del MVP:** el jugador sube su documentación médica. El kinesiólogo la revisa y decide: (a) actualiza la disponibilidad directamente, o (b) registra una lesión y se genera una línea de tiempo de fases de recuperación. Ambos caminos terminan en el dashboard de disponibilidad del plantel (disponible, en recuperación, de baja), que consultan el entrenador y los jugadores.

### Reglas que no se rompen

- **Aislamiento por club:** toda tabla lleva `club_id` y la seguridad la define RLS en la base de datos, no el frontend. Nunca usar la service role key en código de cliente.
- **Datos de salud:** el jugador solo ve la disponibilidad del plantel, nunca lesiones ni documentos de otros. Los documentos médicos los revisa solo el kinesiólogo. El entrenador ve disponibilidad, lesiones y fases.
- **Cambios de base de datos:** siempre en un archivo nuevo dentro de `supabase/migrations/`, sin editar los existentes. Después de cada cambio de políticas, correr `supabase/tests/rls_isolation_test.sql`. No aplicar migraciones al proyecto real sin que Mati las revise.
- **Datos:** solo datos ficticios. Nunca commitear `.env.local` ni claves.
- **Git:** trabajar en ramas y abrir pull request. `main` está protegida.
- **Next.js 16:** `middleware` ahora se llama `proxy.ts`. Antes de usar una API, leer `node_modules/next/dist/docs/`.
# Recov

Seguimiento de lesiones para clubes deportivos amateur. Taller de Emprendimiento Tecnológico y Sostenibilidad, UAI.

**Stack:** Next.js (App Router) · Supabase (Auth, Postgres con RLS, Storage) · Vercel

## Cómo correrlo

```bash
npm install
cp .env.example .env.local   # completa con la URL y la publishable key del proyecto Supabase
npm run dev
```

## Estructura

- `src/proxy.ts` y `src/lib/supabase/session.ts`: refrescan la sesión y protegen las rutas.
- `src/lib/supabase/`: clientes de Supabase (navegador y servidor).
- `src/app/login`, `src/app/dashboard`: login y primer dashboard (lee jugadores con RLS).
- `supabase/migrations/`: esquema y políticas RLS.
- `supabase/tests/rls_isolation_test.sql`: prueba de aislamiento entre clubes.
- `supabase/seed.sql`: datos ficticios de demo.

## Reglas del equipo

- `main` está protegida: los cambios entran por pull request.
- Solo datos ficticios. Las claves van en `.env.local` y nunca se suben al repo.

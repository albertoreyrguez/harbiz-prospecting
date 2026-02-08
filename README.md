# Harbiz Prospecting (MVP Scaffold)

Internal web application scaffold for Harbiz SDR outbound prospecting.

## Tech stack

- Next.js 14 (App Router) + TypeScript
- Supabase (Auth + Postgres)
- Tailwind CSS
- Vercel-ready deployment

## Implemented MVP scaffold

- Auth: email/password login + signup via Supabase Auth
- Single workspace assumption (Harbiz) with seeded workspace row
- Database schema + migrations for:
  - `workspaces`
  - `profiles` (unique `instagram_handle`)
  - `leads` (unique `(workspace_id, profile_id)`)
  - `search_runs`
- Pages:
  - `/login`
  - `/dashboard`
  - `/dashboard/new-search` (mocked submit)
  - `/dashboard/leads` (table + status filter)
  - `/dashboard/leads/[id]` (detail + notes + status)
- API routes:
  - `GET/POST /api/leads`
  - `GET/PATCH/DELETE /api/leads/[id]`
  - `POST /api/mock-seed` (inserts mocked profiles/leads)

## Project structure

- `app/` Next.js App Router pages + route handlers
- `components/` reusable UI components
- `lib/` Supabase clients and shared helpers
- `types/` database typing
- `supabase/migrations/` SQL migrations

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Copy env file:

```bash
cp .env.example .env.local
```

3. Fill required env vars in `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_DEFAULT_WORKSPACE_ID` (optional; if empty, app uses first workspace row)

4. Run migrations in Supabase.

If you use Supabase CLI linked to your project:

```bash
supabase db push
```

Or run SQL files manually in order:

1. `supabase/migrations/202602070001_init_schema.sql`
2. `supabase/migrations/202602070002_seed_workspace.sql`

5. Start dev server:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Notes

- Prospecting/search logic is mocked by design in this phase.
- Instagram scraping is intentionally not implemented.
- API routes currently use the Supabase service role key server-side for scaffold speed.

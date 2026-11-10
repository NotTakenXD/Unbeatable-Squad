# Roshan Rozgar

**Awaz se kaam, bharose ke saath.** A mobile-first web app that connects customers in Pakistan with skilled workers (electricians, plumbers, carpenters, AC technicians). Customers post jobs by voice or text, workers send offers, and bookings are tracked through to a rating.

Built with React 19, Vite, Tailwind CSS v4 and [Supabase](https://supabase.com) (Postgres, Auth, Storage, Realtime).

## Run it locally

Requirements: Node.js 22+.

```bash
npx pnpm install
cp .env.example .env        # then fill in your Supabase URL and publishable key
npx vite --port 3000
```

Open http://localhost:3000. Port 3000 matches Supabase's default Site URL, so email-confirmation links come back to the app.

## Backend

The database schema, security rules (row-level security) and storage buckets are in [`supabase/migrations/`](supabase/migrations/). To set up a fresh Supabase project, run those SQL files in order (SQL editor or `supabase db push`).

Main tables: `profiles`, `worker_profiles`, `services`, `jobs`, `job_offers`, `bookings`, `messages`, `reviews`, `saved_workers`, `worker_portfolio`.
Booking actions go through database functions: `accept_offer`, `decline_offer`, `update_booking_status`.

## Project layout

- `src/App.tsx`: navigation and the splash/home/welcome screens
- `src/screens/customer.tsx`: customer screens (search, request, offers, bookings, rating, chat)
- `src/screens/worker.tsx`: worker screens (voice registration, find work, jobs, earnings, profile)
- `src/lib/api.ts`: all Supabase queries
- `src/lib/session.tsx`: signed-in user and profile state
- `src/ui.tsx`: shared UI components

# Roshan Rozgar (روشن روزگار)

**Awaz se kaam, bharose ke saath.** A mobile-first web app that connects households in Islamabad / Rawalpindi with nearby skilled trade workers (electricians, plumbers, carpenters, AC technicians). Workers who can't read or type comfortably can do everything by voice, in Urdu.

Built for the CUI Tech Fest *AI Web Forge* hackathon.

## How it meets the five required outcomes

| Outcome | How |
|---|---|
| **1. Onboarding** without a sign-up form | Worker taps **Start now — no email needed** (one-tap account, no email/password), then **speaks** their name, trade, experience, area and rates in Urdu, Roman Urdu or English. Speech → text (browser speech recognition), text → profile (Gemini). The profile is **read back aloud in Urdu**; the worker taps one green button to confirm. |
| **2. Discovery** — nearby and available now | Search sorts workers **free first, then nearest, then best rated**. "Nearby" uses Islamabad's sector grid (G-10 → F-10 ≈ 2 km). "Available" excludes workers who are **on a job right now** (from real bookings, not just a toggle). |
| **3. Communication** without typing | Customers describe the job by voice; Gemini fills in service, area, budget and timing. Chat has a **mic button** (speech → message) and a **speaker on every message** (read aloud). Workers set their price with **tap buttons** (−500 / 1,000 / 1,500 / … / +500) and can hear it read back. |
| **4. Booking** — consistent free/engaged state | Customer accepts an offer → booking is created by a database function that **locks the worker and refuses a second booking within 3 hours**. Workers on a job show **On a job** everywhere, live. |
| **5. Trust** | After the job is marked done, only that customer can leave a 1–5 star rating and comment (enforced in the database). Ratings and reviews appear on the worker's profile and in search. |

## AI — what it does and what would break without it

| AI | Used for | Without it |
|---|---|---|
| **Google Gemini 3.6 Flash** (Gemini API free tier, via the `ai-assist` Supabase Edge Function) | Turns messy speech-recognition output (Urdu script, Roman Urdu, English, mixed; e.g. "G gyarah", "paanch saal", "do hazaar") into a structured worker profile or job request, plus a short Urdu summary for read-back. | Low-literacy workers would have to read and fill in a typed form. A simple keyword fallback (`src/lib/extract.ts`) catches only obvious English/Urdu words and is labelled "AI was unavailable" in the UI. |
| **Browser speech recognition** (Web Speech API: Google in Chrome/Android, Microsoft in Edge, Apple in Safari) | Speech → text in Urdu (`ur-PK`) or English, for registration, job requests and chat. | Users would have to type. |
| **Browser speech synthesis** | Reads profiles, jobs, prices and chat messages aloud in Urdu. | Users would have to read. |

The Gemini API key lives only in the Edge Function's secrets — never in the browser. Each user is limited to 40 AI calls per hour.

## Run it locally

Requirements: Node.js 22+.

```bash
npx pnpm install
cp .env.example .env        # fill in your Supabase URL and publishable key
npx vite --port 3000
```

Open http://localhost:3000. Speech recognition works best in **Chrome or Edge** (desktop or Android).

## Backend (Supabase)

- **Database:** run the SQL files in [`supabase/migrations/`](supabase/migrations/) in order (SQL editor or `supabase db push`). They create the tables, row-level security, storage buckets, booking functions and rate limiter.
- **Edge Functions:** deploy both functions in [`supabase/functions/`](supabase/functions/):
  ```bash
  supabase functions deploy ai-assist
  supabase functions deploy quick-start --no-verify-jwt
  supabase secrets set GEMINI_API_KEY=AIza...
  ```
- **Auth settings** (Dashboard → Authentication): set **Site URL** to your deployed URL and add it to **Redirect URLs**; turn on **leaked password protection**.

Main tables: `profiles`, `worker_profiles`, `services`, `jobs`, `job_offers`, `bookings`, `messages`, `reviews`, `saved_workers`, `worker_portfolio`.
Booking actions go through database functions: `accept_offer`, `decline_offer`, `update_booking_status`.

## Security

- Row-level security on every table; column-level grants stop users editing ratings, prices of accepted bookings, or other people's rows.
- Bookings can only be created by `accept_offer` (customer of that job only) and moved forward only by the worker.
- Reviews only by the customer of a **completed** booking, one per booking.
- Messages: you can message a worker, or someone you already share a job, offer, booking or conversation with.
- Customer names are visible only to people they deal with (and next to reviews they wrote).
- Voice notes are private (uploader, workers who can see that job, and worker voice intros).
- Edge Functions: JWT required for AI; per-user and per-IP rate limits; input length caps; API key server-side only.

## Seeded / simulated data

- **Services:** Electrician, Plumber, Carpenter, AC Tech.
- **Demo accounts** (password `RoshanDemo#2026`, all pre-confirmed):
  - Workers: `ali.worker@example.com` (electrician, G-11), `usman.worker@example.com` (plumber, F-10), `bilal.carpenter@example.com` (carpenter, I-8), `hamza.actech@example.com` (AC tech, F-8), `imran.electrician@example.com` (electrician, G-9)
  - Customers: `aleena.customer@example.com`, `sara.customer@example.com`, `fatima.customer@example.com`
- A few seeded jobs, offers, two completed bookings and two reviews.
- **Mocked / out of scope:** payments (the Withdraw button only explains that payment is in cash), identity verification, SMS/phone login, real GPS (distance is estimated from Islamabad sector names).

## Known limitations

- Speech recognition depends on the browser: Firefox has none (the app still records the voice note and lets the user type). Urdu text-to-speech needs an Urdu voice on the device; otherwise a similar voice is used.
- One-tap worker accounts live on that phone. A worker who clears the browser or changes phone loses access unless they add an email.
- "Nearby" is a sector-grid estimate for Islamabad; Rawalpindi areas only match by exact name.
- Supabase's built-in email service sends only a few emails per hour; a real deployment needs custom SMTP.
- The AI can misunderstand speech; every AI-filled field is shown for review and read aloud before saving.

## Tools and credits

- **Stack:** React 19, Vite 8, TypeScript, Tailwind CSS v4, Supabase (Postgres, Auth, Storage, Realtime, Edge Functions), Vercel hosting.
- **Libraries:** `@supabase/supabase-js`. Fonts: Inter and Noto Nastaliq Urdu (Google Fonts). Worker photos in `public/assets/`.
- **AI coding assistants:** the project was scaffolded in **Figma Make** and built with **Claude Code** (Anthropic). Both were used to write and review code during the event.

## Project layout

- `src/App.tsx`: navigation and the splash / home / welcome screens
- `src/screens/customer.tsx`: customer screens (search, request, offers, bookings, rating, chat)
- `src/screens/worker.tsx`: worker screens (voice registration, find work, offers, jobs, earnings, profile)
- `src/screens/auth.tsx`: sign-in, email sign-up and one-tap worker start
- `src/lib/api.ts`: all Supabase and AI calls
- `src/lib/hooks.ts`: data loading, live updates, voice recording, speech recognition and read-aloud
- `src/lib/nearby.ts`: Islamabad sector distance
- `src/lib/extract.ts`: keyword fallback when AI is unavailable
- `supabase/migrations/`: database schema and security rules
- `supabase/functions/`: `ai-assist` (Gemini) and `quick-start` (one-tap worker account)

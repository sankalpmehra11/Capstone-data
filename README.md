# Personal CRM PWA

A mobile-first (Android + desktop first) Personal CRM built with Next.js App Router + Supabase.

## What is included

- Email magic-link auth at `/login`.
- Top navigation: Home, People, Active, Tasks, Settings.
- Person page with:
  - screenshot drag/drop (desktop) + file picker (mobile)
  - optional voice note recording/upload
  - manual typed interaction form
  - memory card + recent interactions
  - WhatsApp + SMS deep links when phone numbers are saved
- Relationship status management (`active`, `hold`, `inactive`) in `/active`.
- Home “Today” section for due tasks and people needing follow-up.
- Tasks page with `.ics` calendar export.
- Light/dark mode toggle.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_publishable_key
```

> In current Supabase UI, the publishable key is the public anon key equivalent for client usage.

3. Apply SQL migrations in Supabase SQL editor in order:

- `supabase/migrations/supabase_schema_v2.sql`
- `supabase/migrations/supabase_migration_v3.sql`

4. Create Supabase Storage bucket `evidence`.

### Recommended storage policy (owner-only paths)

Use paths like `${auth.uid()}/<person_id>/images/...` and `${auth.uid()}/<person_id>/audio/...`.
Restrict read/write so authenticated users can only access files under their own uid prefix.

5. Start dev server:

```bash
npm run dev
```

Then open:

- Laptop: `http://localhost:3000`
- Mobile on same Wi-Fi: `http://<your-laptop-lan-ip>:3000`

## OCR and Transcription

### OCR

- OCR runs client-side via `tesseract.js`.
- After OCR, the app opens a confirm modal so you can edit text + summary before save.

### Transcription (optional, non-blocking)

- `/api/transcribe` currently returns `TRANSCRIPTION_NOT_CONFIGURED`.
- The app still lets you save voice-note interactions by typing summary manually.
- To enable full transcription, replace `transcribeAudio()` in `app/api/transcribe/route.ts` with whisper.cpp or hosted API logic.

## PWA + notifications

- Install PWA from browser “Install app” prompt/menu.
- Settings page includes a basic “Enable notifications” browser permission flow.
- For deeper push notifications (service worker + VAPID + backend delivery), this architecture is ready to extend later.

## Notes

- Focus is Android + desktop today.
- iOS support is still viable later (especially web push and URL-scheme nuances).
- No direct access to iOS Reminders or WhatsApp messages APIs; app uses deep links only.

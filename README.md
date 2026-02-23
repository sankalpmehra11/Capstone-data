# Personal CRM PWA

A mobile-first Personal CRM built with Next.js App Router + Supabase. The app now supports evidence uploads from screenshots and voice notes, browser OCR, extraction storage, interaction creation, and deterministic rolling context memory per person.

## What this release adds

- `/people/[id]` has **Add Evidence** with:
  - Upload Screenshot (`image/*`)
  - Upload Voice Note (`audio/*`)
- Every upload is stored in Supabase Storage bucket: `evidence`.
- New `uploads` and `extractions` records are written for every file.
- Screenshot OCR runs in-browser with `tesseract.js`.
- Voice notes call `/api/transcribe` (local stub path by default).
- Every extraction creates an `interaction` with raw capture + summary.
- `person_memory` keeps an evolving running summary and key facts.
- Follow-up cue detection opens a task draft modal with a +7 day suggested due date.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

3. Apply SQL migration from `supabase/migrations/supabase_schema_v2.sql` in Supabase SQL editor.

4. In Supabase Storage, create bucket `evidence`.

   Recommended bucket policy for app behavior:
   - allow authenticated users upload/read only their own files by path prefix `${auth.uid()}/...`
   - if you use public URLs, ensure privacy expectations are documented.

5. Start dev server:

```bash
npm run dev
```

## OCR and Transcription

### OCR
- OCR is client-side via `tesseract.js`; no paid API needed.
- Mobile upload works via file picker/camera roll if browser supports it.

### Transcription (default local dev path)
- `/api/transcribe` currently returns `TRANSCRIPTION_NOT_CONFIGURED` plus instructions.
- To enable real transcription later, replace `transcribeAudio()` in `app/api/transcribe/route.ts` with:
  - local `whisper.cpp` invocation, or
  - hosted transcription API integration.

The current architecture keeps transcription logic isolated in one function for easy swapping.

## Notes

- This app intentionally does not use WhatsApp/iMessage APIs.
- Evidence is user-uploaded screenshots/voice notes only.

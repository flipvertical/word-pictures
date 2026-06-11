# Word Pictures

A vocabulary tool for middle-school English. Students click parts of a picture
and get descriptive word suggestions (nouns / verbs / adjectives, each with a
kid-friendly meaning and related words) to use in their own writing.

See [DESIGN.md](./DESIGN.md) for the design decisions and roadmap.

## How it works

1. **Teacher** signs in at `/teacher`, uploads an image, clicks **Analyze with AI**
   (Claude proposes hotspots + word lists), reviews and edits, then **Publish**.
2. **Students** open the share link (`/i/...`), tap numbered hotspots, explore
   words, collect them into a word bank, and copy it into their writing.

AI runs only at teacher prep time — students get instant, teacher-reviewed data.

## Running locally

```bash
cp .env.example .env.local   # then fill in ANTHROPIC_API_KEY and ADMIN_PASSWORD
npm install
npm run dev                  # http://localhost:3000
```

Without `ADMIN_PASSWORD` set, the dev password is `icarus`.
Local data lives in `local.db` (SQLite) and `public/uploads/` — both gitignored.

## Deployment

Live at https://word-pictures.vercel.app (Vercel + Turso + Vercel Blob).

Production env vars (set in Vercel): `ANTHROPIC_API_KEY`, `ADMIN_PASSWORD`
(required — no fallback in production), `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`.
Image storage auto-selects Vercel Blob via the connected store's `BLOB_STORE_ID`
(OIDC auth; no read-write token needed in production). The Blob store must be
**Public** access and connected to the project.

Gotchas hit during first deploy, for posterity:
- Vercel's Framework Preset must be "Next.js" — as "Other" it serves only
  `public/` and every route 404s while the build still shows "Ready".
- A **Private** Blob store rejects the app's public uploads.

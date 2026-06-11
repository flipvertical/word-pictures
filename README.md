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

## Deploying (not done yet)

Target: Vercel + Turso. Two things must change first:

- Set `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` (local SQLite file won't work on Vercel).
- Switch image storage from `public/uploads/` to Vercel Blob (`lib/storage.ts`) —
  local files do not persist on Vercel.

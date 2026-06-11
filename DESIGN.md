# Word Pictures — design notes

A vocabulary tool for middle-school English: students click parts of an image and
receive descriptive word suggestions (nouns / verbs / adjectives) to use in their
own writing about the picture.

## Core architecture decision

**AI at teacher prep time, static data at student time.** The teacher uploads an
image; Claude proposes hotspots + word lists once; the teacher reviews, edits and
publishes. Students get pre-baked data — instant taps, no per-student API cost,
every word teacher-reviewed before students see it.

A live "ask about anything you click" mode is a possible v2, not v1.

## Student UX decisions (from wireframe sessions, June 2026)

- **Popover, not side panel.** Words appear in a card next to the tapped hotspot so
  word and subject share the same visual region. Tested both; popover won.
- **Popover placement rule:** the card positions itself *outside the hotspot's
  bounding box* (which the AI/teacher defines), on the side with the most room,
  clamped to the image edges. This avoids occluding the focal point even though
  focal points vary in size.
- **Card is draggable** (drag the header) as a manual escape hatch.
- Tapping another hotspot closes the current card; tapping the image background closes it.
- **Hotspots are small unnumbered dots** (revised June 2026: numbers + large pins
  obscured the subjects). White by default with a dark outline ring; each hotspot
  has a per-hotspot Light/Dark contrast toggle in the editor for pale image areas.
- **Stage flow inside the card:** region name → pick word type (Nouns default
  position, Verbs, Adjectives; adverbs/prepositions deferred) → word chips →
  tap a word for a kid-friendly gloss + "words like this" → explicit Add button.
  Two-step add is deliberate: students read the meaning before collecting.
- **My Words tray** collects words in *sets grouped by hotspot* — dark region pill
  inside a shaded wrapper. Copy button exports plain text
  (`The ship: galleon, glides, stately…`) for pasting into the writing surface.
- **No links out** to Google/thesaurus — glosses and related words are pre-generated
  and reviewed instead.
- **Related words are collectable too** — shown as dashed "+ word" chips under the
  gloss; tapping adds straight to the tray (they have no gloss of their own).
- **Aspect-ratio strategy:** single-column layout. Image full width, capped at
  ~68vh (tall images letterbox), tray below. Works for wide/square/tall images and
  on small laptops/iPads.

## Teacher flow (v1)

Upload (≤4MB JPEG/PNG/WebP/GIF) → analyze → review/edit hotspots (drag dots,
move/resize bounding boxes via corner handles, edit labels/words inline) →
Save → Publish → share `/i/[slug]` link.
Single shared password (`ADMIN_PASSWORD`), no student accounts.

Two analysis modes:
- **AI: propose hotspots** — full auto; the model picks 8-12 subjects across the
  whole image and writes everything.
- **AI: fill empty hotspots** — teacher-guided; only hotspots with no words yet
  are sent to the model, which describes what each dot points at. Pin
  ids/positions/colors are preserved; already-filled hotspots are never touched.
  Composes both ways: run auto then add dots for what it missed, or skip auto
  entirely and lay out every dot by hand, then fill them all.

## AI generation

- `lib/analyze.ts`, model `claude-opus-4-8`, structured output via zod schema,
  streamed (long outputs trip the SDK's non-streaming guard).
- Normalized (0–1) point + bounding box per hotspot; 5–7 words per part of speech;
  each word has a ≤10-word gloss and 3–4 related words.
- Cost is per-image at prep time (a few cents), zero at student time.
- Model boxes can be imprecise — hence the teacher-side box move/resize handles.

## Deferred / later

- Adverbs/prepositions as a per-lesson teacher toggle.
- Tray edit mode if × removal proves undiscoverable for students.
- Other activity types (scrambled sentences, magnetic-poetry matching) — the
  image → regions → tagged-words data model is deliberately activity-agnostic.
- Live "explore mode" (crop around an arbitrary click → model call) with rate
  limiting and moderation.

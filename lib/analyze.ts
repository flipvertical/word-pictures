import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { BoxSchema, WordsSchema, type Hotspot } from "./types";

const AutoSchema = z.object({
  hotspots: z.array(
    z.object({
      label: z.string(),
      x: z.number(),
      y: z.number(),
      box: BoxSchema,
      words: WordsSchema,
    }),
  ),
});

const GuidedSchema = z.object({
  hotspots: z.array(
    z.object({
      index: z.number(),
      label: z.string(),
      box: BoxSchema,
      words: WordsSchema,
    }),
  ),
});

const WORD_RULES = `For each subject provide words a student could use when writing about it: nouns, verbs, and adjectives — 5 to 7 words per part of speech. Mix accessible words with a few stretch words slightly above grade level. Verbs should fit the subject as it appears in the picture (present tense reads best). For each word give:
- gloss: a plain definition a 12-year-old instantly understands, 10 words max
- related: 3-4 similar or connected words

Choose vivid, specific words over generic ones (prefer "trudges" over "walks"). Never include words that are crude or inappropriate for school. All coordinates are fractions of image width/height measured from the top-left, 0 to 1, three decimals.`;

const AUTO_PROMPT = `You are helping a middle-school English teacher prepare a picture for a vocabulary activity. Students (ages 11-14) will click parts of this image and receive descriptive word suggestions to use in their own writing about the picture.

Identify 8-12 distinct visual subjects in the image — concrete things a student would naturally want to write about (a figure, an animal, the sea, a building, the sky, a striking detail). Cover the whole image: foreground and background, large subjects and small telling details, corners as well as the center.

For each subject provide:
- label: a short student-facing name ("The ship", "The plowman")
- x, y: the visual center of the subject
- box: the subject's bounding box {x, y, w, h} — make it tight around the subject, not generous

${WORD_RULES}`;

function guidedPrompt(pins: { label: string; x: number; y: number }[]): string {
  const list = pins
    .map(
      (p, i) =>
        `${i}. "${p.label}" at x=${p.x.toFixed(3)}, y=${p.y.toFixed(3)}`,
    )
    .join("\n");
  return `You are helping a middle-school English teacher prepare a picture for a vocabulary activity. Students (ages 11-14) will click marked parts of this image and receive descriptive word suggestions to use in their own writing about the picture.

The teacher has already placed markers on the subjects they want described. The markers, with their positions as fractions of image width/height from the top-left:

${list}

For EVERY marker, in the same order, look carefully at what is at that exact location in the image and provide:
- index: the marker's number from the list above
- label: a short student-facing name for the subject at that location. If the teacher's label is meaningful, keep it; if it is generic (like "New hotspot"), name the subject yourself.
- box: the subject's bounding box {x, y, w, h} — tight around the subject at that location

${WORD_RULES}`;
}

type ImageInput = {
  imageBase64: string;
  mediaType: string;
  title: string;
};

function imageContent(opts: ImageInput, text: string) {
  return [
    {
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: opts.mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
        data: opts.imageBase64,
      },
    },
    { type: "text" as const, text: `${text}\n\nThe image is titled: "${opts.title}".` },
  ];
}

const clamp = (n: number) => Math.min(1, Math.max(0, n));
const clampBox = (b: { x: number; y: number; w: number; h: number }) => ({
  x: clamp(b.x),
  y: clamp(b.y),
  w: clamp(b.w),
  h: clamp(b.h),
});

// Streamed request (long outputs would trip the SDK's non-streaming guard),
// validated against the zod schema after the fact.
async function runStructured<S extends z.ZodType>(
  schema: S,
  content: ReturnType<typeof imageContent>,
): Promise<z.infer<S>> {
  const client = new Anthropic();
  const stream = client.messages.stream({
    model: "claude-opus-4-8",
    max_tokens: 32000,
    messages: [{ role: "user", content }],
    output_config: { format: zodOutputFormat(schema) },
  });
  const message = await stream.finalMessage();
  const text = message.content.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("Model returned no structured output");
  return schema.parse(JSON.parse(text));
}

export async function analyzeAuto(opts: ImageInput): Promise<Hotspot[]> {
  const parsed = await runStructured(AutoSchema, imageContent(opts, AUTO_PROMPT));
  return parsed.hotspots.map((h, i) => ({
    id: crypto.randomUUID(),
    label: h.label,
    x: clamp(h.x),
    y: clamp(h.y),
    box: clampBox(h.box),
    words: h.words,
    sort: i,
    dotColor: "light" as const,
  }));
}

export async function analyzeGuided(
  opts: ImageInput,
  pins: Hotspot[],
): Promise<Hotspot[]> {
  const parsed = await runStructured(
    GuidedSchema,
    imageContent(
      opts,
      guidedPrompt(pins.map((p) => ({ label: p.label, x: p.x, y: p.y }))),
    ),
  );

  // Keep the teacher's pins (id, position, dot color); take the model's
  // label, box, and words for each.
  return pins.map((pin, i) => {
    const match =
      parsed.hotspots.find((h) => h.index === i) ?? parsed.hotspots[i] ?? null;
    if (!match) return pin;
    const keepLabel =
      pin.label.trim() !== "" && pin.label.trim().toLowerCase() !== "new hotspot";
    return {
      ...pin,
      label: keepLabel ? pin.label : match.label,
      box: clampBox(match.box),
      words: match.words,
      sort: i,
    };
  });
}

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { BoxSchema, WordsSchema, type Hotspot } from "./types";

const AnalysisSchema = z.object({
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

const PROMPT = `You are helping a middle-school English teacher prepare a picture for a vocabulary activity. Students (ages 11–14) will click parts of this image and receive descriptive word suggestions to use in their own writing about the picture.

Identify 6–9 distinct visual subjects in the image — concrete things a student would naturally want to write about (a figure, an animal, the sea, a building, the sky, a striking detail). Prefer subjects spread across the whole image over clustered ones.

For each subject provide:
- label: a short student-facing name ("The ship", "The plowman")
- x, y: the visual center of the subject, as fractions of image width and height from the top-left (0 to 1, three decimals)
- box: the subject's bounding box {x, y, w, h}, also as fractions of image width/height
- words: nouns, verbs, and adjectives a student could use when writing about this subject. 5–6 words per part of speech. Mix accessible words with a few stretch words slightly above grade level. Verbs should fit the subject as it appears in the picture (present tense reads best). For each word give:
  - gloss: a plain definition a 12-year-old instantly understands, 10 words max
  - related: 2–3 similar or connected words

Choose vivid, specific words over generic ones (prefer "trudges" over "walks"). Never include words that are crude or inappropriate for school.`;

export async function analyzeImage(opts: {
  imageBase64: string;
  mediaType: string;
  title: string;
}): Promise<Hotspot[]> {
  const client = new Anthropic();
  const response = await client.messages.parse({
    model: "claude-opus-4-8",
    max_tokens: 16000,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: opts.mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
              data: opts.imageBase64,
            },
          },
          {
            type: "text",
            text: `${PROMPT}\n\nThe image is titled: "${opts.title}".`,
          },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(AnalysisSchema) },
  });

  const parsed = response.parsed_output;
  if (!parsed) throw new Error("Model returned no structured output");

  const clamp = (n: number) => Math.min(1, Math.max(0, n));
  return parsed.hotspots.map((h, i) => ({
    id: crypto.randomUUID(),
    label: h.label,
    x: clamp(h.x),
    y: clamp(h.y),
    box: {
      x: clamp(h.box.x),
      y: clamp(h.box.y),
      w: clamp(h.box.w),
      h: clamp(h.box.h),
    },
    words: h.words,
    sort: i,
  }));
}

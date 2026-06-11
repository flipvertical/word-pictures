import { z } from "zod";

export const POS_KEYS = ["nouns", "verbs", "adjectives"] as const;
export type PosKey = (typeof POS_KEYS)[number];
export const POS_LABELS: Record<PosKey, string> = {
  nouns: "Nouns",
  verbs: "Verbs",
  adjectives: "Adjectives",
};

export const WordEntrySchema = z.object({
  word: z.string(),
  gloss: z.string(),
  related: z.array(z.string()),
});
export type WordEntry = z.infer<typeof WordEntrySchema>;

export const WordsSchema = z.object({
  nouns: z.array(WordEntrySchema),
  verbs: z.array(WordEntrySchema),
  adjectives: z.array(WordEntrySchema),
});
export type Words = z.infer<typeof WordsSchema>;

export const BoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
});
export type Box = z.infer<typeof BoxSchema>;

export type DotColor = "light" | "dark";

export type Hotspot = {
  id: string;
  label: string;
  x: number; // normalized 0-1, pin position
  y: number;
  box: Box | null; // normalized bounding box of the subject
  words: Words;
  sort: number;
  dotColor: DotColor; // dot rendering on the student view, per-hotspot contrast
};

export type ImageRecord = {
  id: string;
  title: string;
  filePath: string; // public URL path, e.g. /uploads/abc.jpg
  mediaType: string;
  width: number;
  height: number;
  status: "draft" | "published";
  shareSlug: string | null;
  createdAt: string;
};

export const emptyWords = (): Words => ({ nouns: [], verbs: [], adjectives: [] });

import { z } from 'zod';

// Shapes verified against api.tcgdex.net/v2/fr on 2026-11-23. Optional fields are genuinely
// missing on some records (e.g. promo cards without `image`, sets without `logo`).

const cardCount = z.object({
  total: z.number().int().nonnegative().optional(),
  official: z.number().int().nonnegative().optional(),
});

export const cardBriefSchema = z.object({
  id: z.string().min(1),
  localId: z.string(),
  name: z.string(),
  image: z.string().optional(),
});

export const cardBriefListSchema = z.array(cardBriefSchema);

export const setBriefSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  logo: z.string().optional(),
  symbol: z.string().optional(),
  cardCount: cardCount.optional(),
});

export const setBriefListSchema = z.array(setBriefSchema);

export const setSchema = setBriefSchema.extend({
  cards: z.array(cardBriefSchema),
});

export const serieSchema = z.object({
  id: z.string(),
  sets: z.array(z.object({ id: z.string() })),
});

export const cardSchema = z.object({
  id: z.string().min(1),
  localId: z.string(),
  name: z.string(),
  image: z.string().optional(),
  category: z.string().optional(),
  illustrator: z.string().optional(),
  rarity: z.string().optional(),
  set: setBriefSchema,
  variants: z
    .object({
      normal: z.boolean().optional(),
      reverse: z.boolean().optional(),
      holo: z.boolean().optional(),
      firstEdition: z.boolean().optional(),
    })
    .optional(),
});

export type TcgdexCardBrief = z.infer<typeof cardBriefSchema>;
export type TcgdexSetBrief = z.infer<typeof setBriefSchema>;
export type TcgdexCard = z.infer<typeof cardSchema>;

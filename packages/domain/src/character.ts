import { z } from "zod";
import { elementSchools, elements, strokeSystems } from "./constraints.ts";

export const provenanceSchema = z.object({
  sourceId: z.string().min(1),
  sourceVersion: z.string().min(1),
  confidence: z.enum(["high", "medium", "low"]),
  reviewStatus: z.enum(["unreviewed", "reviewed", "disputed"])
}).strict();

export const characterSchema = z
  .object({
    char: z.string().regex(/^\p{Script=Han}$/u, "must be exactly one Han character"),
    strokes: z.record(z.enum(strokeSystems), z.number().int().positive()).default({}),
    elements: z.record(z.enum(elementSchools), z.enum(elements)).default({}),
    rarityBand: z.enum(["common", "uncommon", "rare"]).optional(),
    inputDifficulty: z.number().min(0).max(1).optional(),
    tags: z.array(z.string()).default([]),
    readings: z.array(z.string().min(1)).default([]),
    meaning: z.string().max(500).optional(),
    provenance: provenanceSchema.optional()
  })
  .strict();

export type Character = z.infer<typeof characterSchema>;

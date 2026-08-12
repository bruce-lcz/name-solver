import { z } from "zod";
import { createHash } from "node:crypto";

export const strokeSystems = ["kangxi", "modern"] as const;
export const elementSchools = ["radical", "numerology"] as const;
export const elements = ["wood", "fire", "earth", "metal", "water"] as const;

const hanCharacter = z
  .string()
  .regex(/^\p{Script=Han}$/u, "must be exactly one Han character");

const strokeFilterSchema = z
  .object({
    values: z.array(z.number().int().positive()).min(1).optional(),
    min: z.number().int().positive().optional(),
    max: z.number().int().positive().optional()
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.values && value.min === undefined && value.max === undefined) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "requires values or a range" });
    }
    if (value.min !== undefined && value.max !== undefined && value.min > value.max) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "min cannot exceed max" });
    }
  });

const elementFilterSchema = z
  .object({
    school: z.enum(elementSchools),
    values: z.array(z.enum(elements)).min(1)
  })
  .strict();

export const positionConstraintSchema = z
  .object({
    strokeSystem: z.enum(strokeSystems),
    strokes: strokeFilterSchema.optional(),
    element: elementFilterSchema.optional(),
    requiredChar: hanCharacter.nullable().default(null),
    allowedChars: z.array(hanCharacter).default([]),
    excludedChars: z.array(hanCharacter).default([])
  })
  .strict()
  .superRefine((value, context) => {
    if (value.requiredChar && value.excludedChars.includes(value.requiredChar)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "requiredChar cannot be excluded" });
    }
    if (value.requiredChar && value.allowedChars.length > 0 && !value.allowedChars.includes(value.requiredChar)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "requiredChar must be included in allowedChars" });
    }
  });

export const constraintsV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    surname: z.string().min(1).max(8),
    givenNameLength: z.number().int().min(1).max(3),
    genderStyle: z.enum(["feminine", "masculine", "neutral"]).optional(),
    positions: z.array(positionConstraintSchema).min(1).max(3),
    totalStrokes: strokeFilterSchema.optional(),
    hardExcludedChars: z.array(hanCharacter).default([]),
    softExcludedChars: z.array(hanCharacter).default([]),
    preferences: z
      .object({
        rarity: z.enum(["common", "uncommon", "rare"]).optional(),
        avoidNegativeHomophones: z.boolean().default(false),
        avoidDifficultCharacters: z.boolean().default(false),
        styles: z.array(z.string().min(1)).default([])
      })
      .strict()
      .default({ avoidNegativeHomophones: false, avoidDifficultCharacters: false, styles: [] })
  })
  .strict()
  .superRefine((value, context) => {
    if (value.positions.length !== value.givenNameLength) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["positions"],
        message: "positions must have one entry for each given-name character"
      });
    }
  });

export type ConstraintV1 = z.infer<typeof constraintsV1Schema>;
export type PositionConstraint = z.infer<typeof positionConstraintSchema>;

export const solveRequestSchema = z.object({
  constraints: constraintsV1Schema,
  characters: z.array(z.unknown()).optional(),
  limit: z.number().int().min(1).max(100).default(20)
}).strict();

export function isStrokeMatch(strokes: number, filter: z.infer<typeof strokeFilterSchema> | undefined): boolean {
  if (!filter) return true;
  if (filter.values && !filter.values.includes(strokes)) return false;
  if (filter.min !== undefined && strokes < filter.min) return false;
  if (filter.max !== undefined && strokes > filter.max) return false;
  return true;
}

/** A stable identifier for cache keys, cursors, and privacy-preserving telemetry. */
export function canonicalConstraintHash(constraints: ConstraintV1): string {
  const canonical = stableSerialize(constraints);
  return createHash("sha256").update(canonical).digest("hex");
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

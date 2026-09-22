import { characterSchema, type Character } from "../../../../packages/domain/src/index.ts";
import fixtureCharacters from "../../../../data/fixtures/characters.v1.json" with { type: "json" };
import cnsCharacters from "../../../../data/releases/cns11643-20260805/characters.json" with { type: "json" };

export const datasetVersion = "cns11643-20260805+reviewed-fixture";

// CNS supplies the broad, modern-stroke base. The reviewed fixture overlays
// its richer metadata for the small set that has been manually checked.
const reviewedByChar = new Map((fixtureCharacters as unknown[]).map((value) => {
  const character = characterSchema.parse(value);
  return [character.char, character] as const;
}));
export const allCharacters: Character[] = (cnsCharacters as unknown[]).map((value) => {
  const base = characterSchema.parse(value);
  const reviewed = reviewedByChar.get(base.char);
  return reviewed ? characterSchema.parse({
    ...base, ...reviewed,
    strokes: { ...base.strokes, ...reviewed.strokes },
    elements: { ...base.elements, ...reviewed.elements },
    tags: reviewed.tags.length ? reviewed.tags : base.tags,
    readings: reviewed.readings.length ? reviewed.readings : base.readings,
  }) : base;
});

// Kept as a small reviewed view for fixture-oriented diagnostics and tests.
export const characters: Character[] = [...reviewedByChar.values()];

export function findCharacter(char: string): Character | undefined {
  return characters.find((character) => character.char === char);
}

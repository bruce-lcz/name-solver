import { readFileSync } from "node:fs";
import { characterSchema, type Character } from "../../../../packages/domain/src/index.ts";

export const datasetVersion = "fixtures-1.0.0";
const fixturePath = new URL("../../../../data/fixtures/characters.v1.json", import.meta.url);
const rawCharacters: unknown[] = JSON.parse(readFileSync(fixturePath, "utf8"));
export const characters: Character[] = rawCharacters.map((character) => characterSchema.parse(character));

export function findCharacter(char: string): Character | undefined {
  return characters.find((character) => character.char === char);
}

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { characterSchema, type Character } from "../../domain/src/index.ts";

export interface ImportReport {
  sourcePath: string;
  checksum: string;
  validCharacters: number;
  invalidRows: Array<{ index: number; reason: string }>;
  duplicateCharacters: string[];
}

export async function importCharacterRelease(sourcePath: string): Promise<{ characters: Character[]; report: ImportReport }> {
  const raw = await readFile(sourcePath, "utf8");
  const checksum = createHash("sha256").update(raw).digest("hex");
  const records: unknown[] = JSON.parse(raw);
  const characters: Character[] = [];
  const invalidRows: ImportReport["invalidRows"] = [];
  const seen = new Set<string>();
  const duplicateCharacters: string[] = [];
  records.forEach((record, index) => {
    const parsed = characterSchema.safeParse(record);
    if (!parsed.success) {
      invalidRows.push({ index, reason: parsed.error.issues.map((issue) => issue.message).join("; ") });
      return;
    }
    if (seen.has(parsed.data.char)) {
      duplicateCharacters.push(parsed.data.char);
      return;
    }
    seen.add(parsed.data.char);
    characters.push(parsed.data);
  });
  return { characters, report: { sourcePath, checksum, validCharacters: characters.length, invalidRows, duplicateCharacters } };
}

export async function writeImportReport(destination: string, report: ImportReport): Promise<void> {
  await writeFile(destination, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

export function diffCharacterReleases(previous: Character[], next: Character[]) {
  const oldByChar = new Map(previous.map((character) => [character.char, character]));
  const nextByChar = new Map(next.map((character) => [character.char, character]));
  return {
    added: next.filter((character) => !oldByChar.has(character.char)).map((character) => character.char),
    removed: previous.filter((character) => !nextByChar.has(character.char)).map((character) => character.char),
    changed: next.filter((character) => {
      const prior = oldByChar.get(character.char);
      return prior !== undefined && JSON.stringify(prior) !== JSON.stringify(character);
    }).map((character) => character.char)
  };
}

export * from "./cns11643.ts";

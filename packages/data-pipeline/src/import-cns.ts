import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import { resolve, join } from "node:path";
import { characterSchema } from "../../domain/src/index.ts";

/** Read the central directory; file names never become filesystem paths. */
export function readZip(buffer: Buffer): Map<string, string> {
  let end = buffer.length - 22;
  while (end >= Math.max(0, buffer.length - 65557) && buffer.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < 0) throw new Error("Invalid ZIP directory");
  let offset = buffer.readUInt32LE(end + 16);
  const files = new Map<string, string>();
  for (let i = 0; i < buffer.readUInt16LE(end + 10); i++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error("Invalid ZIP entry");
    const method = buffer.readUInt16LE(offset + 10);
    const size = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    const local = buffer.readUInt32LE(offset + 42);
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    if (name.endsWith(".txt")) {
      const compressed = buffer.subarray(start, start + size);
      if (method !== 0 && method !== 8) throw new Error(`Unsupported ZIP compression ${method}`);
      const raw = method === 8 ? inflateRawSync(compressed, { maxOutputLength: 64 * 1024 * 1024 }) : compressed;
      files.set(name, raw.toString("utf8").replace(/^\uFEFF/, ""));
    }
    offset += 46 + nameLength + buffer.readUInt16LE(offset + 30) + buffer.readUInt16LE(offset + 32);
  }
  return files;
}

export function parseCns(properties: Map<string, string>, mappings: Map<string, string>, version: string) {
  const table = (name: string) => {
    const content = properties.get(name);
    if (!content) throw new Error(`Missing CNS resource ${name}`);
    return new Map(content.trim().split(/\r?\n/).map(line => {
      const [id, ...values] = line.split("\t");
      return [id, values.join("\t")] as const;
    }));
  };
  const strokes = table("CNS_stroke.txt");
  const phonetic = table("CNS_phonetic.txt");
  const records = new Map<string, { ids: string[]; strokes: Set<number>; readings: Set<string> }>();
  const privateUse = new Set<number>();
  const other = new Set<number>();
  for (const [name, content] of mappings) {
    if (!name.startsWith("Unicode/CNS2UNICODE_")) continue;
    for (const line of content.trim().split(/\r?\n/)) {
      const [id, hex] = line.split("\t");
      if (!id || !/^[0-9a-f]+$/i.test(hex ?? "")) throw new Error(`Invalid Unicode mapping: ${line}`);
      const cp = Number.parseInt(hex, 16);
      const char = String.fromCodePoint(cp);
      // CNS also maps radicals, ideographic descriptions, punctuation and
      // private-use glyphs. They are valid Unicode data but are not name
      // characters, so keep only CJK unified/compatibility ideographs.
      const nameCodePoint = (cp >= 0x3400 && cp <= 0x4dbf) || (cp >= 0x4e00 && cp <= 0x9fff)
        || (cp >= 0xf900 && cp <= 0xfaff) || (cp >= 0x20000 && cp <= 0x323af) || cp === 0x3007;
      if (!nameCodePoint) {
        ((cp >= 0xe000 && cp <= 0xf8ff) || (cp >= 0xf0000 && cp <= 0xffffd) || (cp >= 0x100000 && cp <= 0x10fffd) ? privateUse : other).add(cp);
        continue;
      }
      const record = records.get(char) ?? { ids: [], strokes: new Set<number>(), readings: new Set<string>() };
      record.ids.push(id);
      const stroke = Number(strokes.get(id));
      if (Number.isInteger(stroke) && stroke > 0) record.strokes.add(stroke);
      const reading = phonetic.get(id);
      if (reading) for (const item of reading.split(/[,;；\t]/)) record.readings.add(item.trim());
      records.set(char, record);
    }
  }
  const conflicts: string[] = [];
  const characters = [...records].sort(([a], [b]) => a.codePointAt(0)! - b.codePointAt(0)!).map(([char, record]) => {
    if (record.strokes.size > 1) conflicts.push(char);
    return characterSchema.parse({
      char, strokes: record.strokes.size === 1 ? { modern: [...record.strokes][0] } : {},
      elements: {}, tags: [], readings: [...record.readings],
      provenance: { sourceId: "cns11643", sourceVersion: version, confidence: "high", reviewStatus: "unreviewed" }
    });
  });
  return { characters, report: {
    version, characters: characters.length, modernStrokes: characters.filter(c => c.strokes.modern !== undefined).length,
    readings: characters.filter(c => c.readings.length > 0).length,
    excludedPrivateUse: privateUse.size, excludedOther: other.size, conflictingStrokes: conflicts,
    unavailableFields: ["kangxi", "elements", "meaning", "rarityBand", "inputDifficulty", "tags"],
    scope: "CNS mappings in CJK unified/compatibility ideograph ranges; radicals, private-use mappings and non-name code points excluded"
  } };
}

export async function importCns(snapshot: string, output: string) {
  const manifest = JSON.parse(await readFile(join(snapshot, "manifest.json"), "utf8"));
  const archives: Map<string, string>[] = [];
  for (const filename of ["Properties.zip", "MapingTables.zip"]) {
    const raw = await readFile(join(snapshot, filename));
    const expected = manifest.resources.find((r: { filename: string }) => r.filename === filename)?.checksum;
    if (!expected || createHash("sha256").update(raw).digest("hex") !== expected) throw new Error(`Checksum mismatch: ${filename}`);
    archives.push(readZip(raw));
  }
  const release = parseCns(archives[0], archives[1], manifest.version);
  await mkdir(output, { recursive: true });
  await writeFile(join(output, "characters.json"), JSON.stringify(release.characters));
  await writeFile(join(output, "report.json"), JSON.stringify({ ...release.report, sources: manifest.resources }, null, 2) + "\n");
  return release.report;
}

if (process.argv[1]?.endsWith("import-cns.ts")) {
  const snapshot = resolve(process.argv[2] ?? "data/raw/cns11643/20260805");
  const output = resolve(process.argv[3] ?? "data/releases/cns11643-20260805");
  console.log(JSON.stringify(await importCns(snapshot, output), null, 2));
}

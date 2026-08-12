#!/usr/bin/env node
import { resolve } from "node:path";
import { importCharacterRelease, writeImportReport } from "./index.ts";

const [source = "data/fixtures/characters.v1.json", report = "data/fixtures/characters.v1.report.json"] = process.argv.slice(2);
const run = async () => {
  const result = await importCharacterRelease(resolve(source));
  await writeImportReport(resolve(report), result.report);
  console.log(JSON.stringify(result.report, null, 2));
  if (result.report.invalidRows.length || result.report.duplicateCharacters.length) process.exitCode = 1;
};
void run();

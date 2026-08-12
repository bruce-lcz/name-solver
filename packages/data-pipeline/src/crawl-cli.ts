#!/usr/bin/env node
import { crawlCns11643 } from "./cns11643.ts";

const outputRoot = process.argv[2] ?? "data/raw";
crawlCns11643(outputRoot)
  .then((manifest) => console.log(JSON.stringify(manifest, null, 2)))
  .catch((error: unknown) => { console.error(error); process.exitCode = 1; });

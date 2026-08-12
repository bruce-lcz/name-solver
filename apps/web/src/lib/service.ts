import { constraintsV1Schema, canonicalConstraintHash } from "../../../../packages/domain/src/index.ts";
import { diagnose } from "../../../../packages/diagnostics/src/index.ts";
import { diversityRerank, rank } from "../../../../packages/ranking/src/index.ts";
import { solve } from "../../../../packages/solver/src/index.ts";
import { characters, datasetVersion } from "./catalog.ts";
import { audit, readCache, writeCache } from "./runtime.ts";

export interface SolveNameResponse {
  queryId: string;
  datasetVersion: string;
  scoringVersion: string;
  counts: ReturnType<typeof solve>["counts"];
  results: ReturnType<typeof diversityRerank>;
  nextCursor: null;
  cached: boolean;
}

export function solveName(rawConstraints: unknown, suppliedCharacters?: unknown[], limit = 20): SolveNameResponse {
  const constraints = constraintsV1Schema.parse(rawConstraints);
  const cached = suppliedCharacters ? undefined : readCache<SolveNameResponse>(constraints);
  if (cached) return { ...cached, cached: true };
  const hard = solve(constraints, suppliedCharacters ?? characters, 100);
  const ranked = diversityRerank(rank(hard.results, constraints), limit);
  const result = {
    queryId: canonicalConstraintHash(constraints).slice(0, 16),
    datasetVersion,
    scoringVersion: "v1",
    counts: hard.counts,
    results: ranked,
    nextCursor: null,
    cached: false
  };
  if (!suppliedCharacters) writeCache(constraints, result);
  audit("solve", { queryId: result.queryId, results: ranked.length, hardMatches: hard.counts.hardConstraintMatches });
  return result;
}

export function analyzeName(name: string) {
  const chars = [...name].map((char) => characters.find((candidate) => candidate.char === char)).filter(Boolean);
  return { name, found: chars, unknownCharacters: [...name].filter((char) => !chars.some((candidate) => candidate?.char === char)) };
}

export function diagnoseName(rawConstraints: unknown) {
  return diagnose(rawConstraints, characters);
}

export function explanationFacts(result: { name: string; score: number; scoreBreakdown: Record<string, number>; characters: Array<{ char: string; meaning?: string; tags: string[] }> }) {
  return {
    summary: `${result.name} 符合所有硬性條件，綜合偏好分數為 ${result.score}。`,
    whyRecommended: result.characters.map((character) => `${character.char}${character.meaning ? `：${character.meaning}` : ""}`).join("；"),
    cautions: result.scoreBreakdown.softExclusions < 0 ? ["名稱含有偏好排除字，已保留但降低排序。"] : [],
    factsOnly: true
  };
}

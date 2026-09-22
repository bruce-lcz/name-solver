import { constraintsV1Schema, canonicalConstraintHash } from "../../../../packages/domain/src/index.ts";
import { diversityRerank, rank } from "../../../../packages/ranking/src/index.ts";
import { solve } from "../../../../packages/solver/src/index.ts";
import { SearchIndex } from "../../../../packages/solver/src/explore.ts";
import { allCharacters, datasetVersion } from "./catalog.ts";
import { audit, readCache, writeCache } from "./runtime.ts";

export interface SolveNameResponse {
  queryId: string;
  datasetVersion: string;
  scoringVersion: string;
  counts: ReturnType<typeof solve>["counts"];
  results: ReturnType<typeof diversityRerank>;
  nextCursor: string | null;
  pools: Array<{ position: number; items: ReturnType<SearchIndex["pool"]>["items"]; total: number; nextOffset: number | null }>;
  pendingPools: Array<{ position: number; items: ReturnType<SearchIndex["pool"]>["items"]; total: number; nextOffset: number | null }>;
  pendingCombinations: number;
  cached: boolean;
}

export interface ExploreOptions {
  offset?: number;
  fixedCharacters?: Array<string | null>;
  poolLimit?: number;
  poolOffsets?: number[];
  poolStatus?: "eligible" | "pending";
}

function applyFixedCharacters(constraints: ReturnType<typeof constraintsV1Schema.parse>, fixedCharacters: Array<string | null> | undefined) {
  if (!fixedCharacters) return constraints;
  return constraintsV1Schema.parse({
    ...constraints,
    positions: constraints.positions.map((position, index) => {
      const fixed = fixedCharacters[index];
      return fixed ? { ...position, requiredChar: fixed } : position;
    })
  });
}

export function solveName(rawConstraints: unknown, suppliedCharacters?: unknown[], limit = 20, options: ExploreOptions = {}): SolveNameResponse {
  const parsed = constraintsV1Schema.parse(rawConstraints);
  const constraints = applyFixedCharacters(parsed, options.fixedCharacters);
  const cacheable = !suppliedCharacters && limit === 20 && options.offset === undefined
    && options.fixedCharacters === undefined && options.poolOffsets === undefined
    && options.poolLimit === undefined && options.poolStatus === undefined;
  const cached = cacheable ? readCache<SolveNameResponse>(constraints) : undefined;
  if (cached) return { ...cached, cached: true };
  if (suppliedCharacters) {
    const hard = solve(constraints, suppliedCharacters, Math.max(limit, 100));
    const ranked = diversityRerank(rank(hard.results, constraints), limit);
    const result = {
      queryId: canonicalConstraintHash(constraints).slice(0, 16), datasetVersion, scoringVersion: "v1",
      counts: hard.counts, results: ranked, nextCursor: null,
      pools: [], pendingPools: [], pendingCombinations: 0, cached: false
    };
    return result;
  }

  const index = new SearchIndex(constraints, allCharacters);
  const offset = options.offset ?? 0;
  const results = index.page(offset, limit);
  const poolLimit = options.poolLimit ?? 24;
  const poolOffsets = options.poolOffsets ?? [];
  const requestedPoolStatus = options.poolStatus ?? "eligible";
  const pools = constraints.positions.map((_, position) => {
    const page = index.pool(position, requestedPoolStatus, poolOffsets[position] ?? 0, poolLimit);
    return { position, ...page };
  });
  const pendingPools = constraints.positions.map((_, position) => {
    const page = index.pool(position, "pending", poolOffsets[position] ?? 0, poolLimit);
    return { position, ...page };
  });
  const result = {
    queryId: canonicalConstraintHash(constraints).slice(0, 16),
    datasetVersion,
    scoringVersion: "v1",
    counts: index.counts,
    results,
    nextCursor: offset + results.length < index.counts.hardConstraintMatches ? String(offset + results.length) : null,
    pools,
    pendingPools,
    pendingCombinations: index.pendingCombinations,
    cached: false
  };
  if (cacheable) writeCache(constraints, result);
  audit("solve", { queryId: result.queryId, results: results.length, hardMatches: index.counts.hardConstraintMatches, pending: index.pendingCombinations });
  return result;
}

export function analyzeName(name: string) {
  const chars = [...name].map((char) => allCharacters.find((candidate) => candidate.char === char)).filter(Boolean);
  return { name, found: chars, unknownCharacters: [...name].filter((char) => !chars.some((candidate) => candidate?.char === char)) };
}

export function diagnoseName(rawConstraints: unknown) {
  const constraints = constraintsV1Schema.parse(rawConstraints);
  const baseline = new SearchIndex(constraints, allCharacters).counts;
  const variants: Array<{ rule: string; constraints: typeof constraints }> = [];
  if (constraints.totalStrokes) variants.push({ rule: "totalStrokes", constraints: { ...constraints, totalStrokes: undefined } });
  if (constraints.hardExcludedChars.length) variants.push({ rule: "hardExcludedChars", constraints: { ...constraints, hardExcludedChars: [] } });
  constraints.positions.forEach((position, index) => {
    if (position.strokes) variants.push({ rule: `positions.${index}.strokes`, constraints: { ...constraints, positions: constraints.positions.map((value, i) => i === index ? { ...value, strokes: undefined } : value) } });
    if (position.element) variants.push({ rule: `positions.${index}.element`, constraints: { ...constraints, positions: constraints.positions.map((value, i) => i === index ? { ...value, element: undefined } : value) } });
    if (position.requiredChar) variants.push({ rule: `positions.${index}.requiredChar`, constraints: { ...constraints, positions: constraints.positions.map((value, i) => i === index ? { ...value, requiredChar: null } : value) } });
  });
  const relaxations = variants.map(({ rule, constraints: variant }) => {
    const matchesAfterRelaxing = new SearchIndex(variant, allCharacters).counts.hardConstraintMatches;
    return { rule, matchesAfterRelaxing, improvement: matchesAfterRelaxing - baseline.hardConstraintMatches };
  }).filter((item) => item.improvement > 0).sort((left, right) => right.improvement - left.improvement);
  const best = relaxations[0];
  return { counts: baseline, relaxations, suggestion: best ? `若放寬 ${best.rule}，可增加 ${best.improvement} 個符合硬條件的組合。` : undefined };
}

export function explanationFacts(result: { name: string; score: number; scoreBreakdown: Record<string, number>; characters: Array<{ char: string; meaning?: string; tags: string[] }> }) {
  return {
    summary: `${result.name} 符合所有硬性條件，綜合偏好分數為 ${result.score}。`,
    whyRecommended: result.characters.map((character) => `${character.char}${character.meaning ? `：${character.meaning}` : ""}`).join("；"),
    cautions: result.scoreBreakdown.softExclusions < 0 ? ["名稱含有偏好排除字，已保留但降低排序。"] : [],
    factsOnly: true
  };
}

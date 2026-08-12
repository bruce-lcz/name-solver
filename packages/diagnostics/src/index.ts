import { constraintsV1Schema, type ConstraintV1 } from "../../domain/src/index.ts";
import { solve, type StageCounts } from "../../solver/src/index.ts";

export interface Relaxation {
  rule: string;
  matchesAfterRelaxing: number;
  improvement: number;
}

export interface Diagnosis {
  counts: StageCounts;
  relaxations: Relaxation[];
  suggestion?: string;
}

function relaxedVariants(constraints: ConstraintV1): Array<{ rule: string; constraints: ConstraintV1 }> {
  const variants: Array<{ rule: string; constraints: ConstraintV1 }> = [];
  if (constraints.totalStrokes) variants.push({ rule: "totalStrokes", constraints: { ...constraints, totalStrokes: undefined } });
  if (constraints.hardExcludedChars.length) variants.push({ rule: "hardExcludedChars", constraints: { ...constraints, hardExcludedChars: [] } });
  constraints.positions.forEach((position, index) => {
    if (position.strokes) variants.push({ rule: `positions.${index}.strokes`, constraints: { ...constraints, positions: constraints.positions.map((value, i) => i === index ? { ...value, strokes: undefined } : value) } });
    if (position.element) variants.push({ rule: `positions.${index}.element`, constraints: { ...constraints, positions: constraints.positions.map((value, i) => i === index ? { ...value, element: undefined } : value) } });
    if (position.requiredChar) variants.push({ rule: `positions.${index}.requiredChar`, constraints: { ...constraints, positions: constraints.positions.map((value, i) => i === index ? { ...value, requiredChar: null } : value) } });
  });
  return variants;
}

export function diagnose(rawConstraints: unknown, characters: unknown[]): Diagnosis {
  const constraints = constraintsV1Schema.parse(rawConstraints);
  const baseline = solve(constraints, characters, 1).counts;
  const relaxations = relaxedVariants(constraints)
    .map(({ rule, constraints: relaxed }) => {
      const matchesAfterRelaxing = solve(relaxed, characters, 1).counts.hardConstraintMatches;
      return { rule, matchesAfterRelaxing, improvement: matchesAfterRelaxing - baseline.hardConstraintMatches };
    })
    .filter((item) => item.improvement > 0)
    .sort((left, right) => right.improvement - left.improvement);
  const best = relaxations[0];
  return {
    counts: baseline,
    relaxations,
    suggestion: best ? `若放寬 ${best.rule}，可增加 ${best.improvement} 個符合硬條件的組合。` : undefined
  };
}

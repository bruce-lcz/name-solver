import {
  characterSchema,
  constraintsV1Schema,
  isStrokeMatch,
  type Character,
  type ConstraintV1,
  type PositionConstraint
} from "../../domain/src/index.ts";

export type RejectionCode =
  | "hard_excluded"
  | "required_char"
  | "allowed_chars"
  | "excluded_chars"
  | "missing_strokes"
  | "strokes"
  | "missing_element"
  | "element"
  | "total_strokes";

export interface CharacterCheck {
  character: string;
  position: number;
  passed: boolean;
  failures: RejectionCode[];
}

export interface SolveResult {
  name: string;
  characters: Character[];
  totalStrokes?: number;
  constraintMatch: true;
  checks: CharacterCheck[];
}

export interface StageCounts {
  inputCharacters: number;
  positionCandidates: number[];
  combinations: number;
  hardConstraintMatches: number;
  rejectedByRule: Partial<Record<RejectionCode, number>>;
}

export interface SolveResponse {
  results: SolveResult[];
  counts: StageCounts;
}

function checkCharacter(
  character: Character,
  position: number,
  constraint: PositionConstraint,
  globalExcluded: readonly string[]
): CharacterCheck {
  const failures: RejectionCode[] = [];
  if (globalExcluded.includes(character.char)) failures.push("hard_excluded");
  if (constraint.requiredChar && character.char !== constraint.requiredChar) failures.push("required_char");
  if (constraint.allowedChars.length > 0 && !constraint.allowedChars.includes(character.char)) failures.push("allowed_chars");
  if (constraint.excludedChars.includes(character.char)) failures.push("excluded_chars");

  const strokes = character.strokes[constraint.strokeSystem];
  if (constraint.strokes) {
    if (strokes === undefined) failures.push("missing_strokes");
    else if (!isStrokeMatch(strokes, constraint.strokes)) failures.push("strokes");
  }

  if (constraint.element) {
    const element = character.elements[constraint.element.school];
    if (!element) failures.push("missing_element");
    else if (!constraint.element.values.includes(element)) failures.push("element");
  }
  return { character: character.char, position, passed: failures.length === 0, failures };
}

function cartesian<T>(groups: T[][]): T[][] {
  return groups.reduce<T[][]>((accumulator, group) =>
    accumulator.flatMap((prefix) => group.map((item) => [...prefix, item])), [[]]);
}

/**
 * Runs only deterministic hard constraints. `totalStrokes` is the sum of the
 * given-name characters under each position's declared stroke system.
 */
export function solve(rawConstraints: unknown, rawCharacters: unknown[], limit = 50): SolveResponse {
  const constraints = constraintsV1Schema.parse(rawConstraints);
  const characters = rawCharacters.map((character) => characterSchema.parse(character));
  const rejectedByRule: Partial<Record<RejectionCode, number>> = {};
  const candidates = constraints.positions.map((position, index) =>
    characters.filter((character) => {
      const check = checkCharacter(character, index, position, constraints.hardExcludedChars);
      for (const failure of check.failures) rejectedByRule[failure] = (rejectedByRule[failure] ?? 0) + 1;
      return check.passed;
    })
  );
  const combinations = cartesian(candidates);
  const matches: SolveResult[] = [];

  for (const combo of combinations) {
    const strokes = combo.map((character, index) => character.strokes[constraints.positions[index].strokeSystem]);
    const totalStrokes = strokes.every((stroke): stroke is number => stroke !== undefined)
      ? strokes.reduce((sum, stroke) => sum + stroke, 0)
      : undefined;
    if (constraints.totalStrokes && (totalStrokes === undefined || !isStrokeMatch(totalStrokes, constraints.totalStrokes))) {
      rejectedByRule.total_strokes = (rejectedByRule.total_strokes ?? 0) + 1;
      continue;
    }
    matches.push({
      name: `${constraints.surname}${combo.map((character) => character.char).join("")}`,
      characters: combo,
      totalStrokes,
      constraintMatch: true,
      checks: combo.map((character, index) => checkCharacter(character, index, constraints.positions[index], constraints.hardExcludedChars))
    });
  }

  return {
    results: matches.slice(0, limit),
    counts: {
      inputCharacters: characters.length,
      positionCandidates: candidates.map((group) => group.length),
      combinations: combinations.length,
      hardConstraintMatches: matches.length,
      rejectedByRule
    }
  };
}

export function parseConstraints(input: unknown): ConstraintV1 {
  return constraintsV1Schema.parse(input);
}

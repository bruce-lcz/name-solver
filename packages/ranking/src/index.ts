import type { Character, ConstraintV1 } from "../../domain/src/index.ts";
import type { SolveResult } from "../../solver/src/index.ts";

export interface ScoreBreakdown {
  rarity: number;
  style: number;
  easeOfInput: number;
  softExclusions: number;
  negativeHomophones: number;
  repetition: number;
  total: number;
}

export interface RankedResult extends SolveResult {
  score: number;
  scoreBreakdown: ScoreBreakdown;
}

const rarityPoints = { common: 4, uncommon: 10, rare: 7 } as const;

export function score(result: SolveResult, constraints: ConstraintV1): ScoreBreakdown {
  const characters = result.characters;
  const rarity = constraints.preferences.rarity
    ? characters.reduce((sum, character) => sum + (character.rarityBand && character.rarityBand === constraints.preferences.rarity ? rarityPoints[character.rarityBand] : 0), 0)
    : 0;
  const style = constraints.preferences.styles.length === 0 ? 0 : characters.reduce(
    (sum, character) => sum + character.tags.filter((tag) => constraints.preferences.styles.includes(tag)).length * 6, 0);
  const easeOfInput = constraints.preferences.avoidDifficultCharacters
    ? Math.round(characters.reduce((sum, character) => sum + (character.inputDifficulty === undefined ? 0 : (1 - character.inputDifficulty) * 8), 0))
    : 0;
  const softExclusions = characters.some((character) => constraints.softExcludedChars.includes(character.char)) ? -30 : 0;
  // Rules are deliberately conservative until a reviewed pronunciation release is loaded.
  const negativeHomophones = constraints.preferences.avoidNegativeHomophones && characters.some((character) =>
    character.readings.some((reading) => ["si", "sha"].includes(reading.toLowerCase()))) ? -20 : 0;
  const repetition = new Set(characters.map((character) => character.char)).size === characters.length ? 0 : -15;
  return { rarity, style, easeOfInput, softExclusions, negativeHomophones, repetition, total: rarity + style + easeOfInput + softExclusions + negativeHomophones + repetition };
}

/** Soft preferences never alter hard-constraint eligibility. */
export function rank(results: SolveResult[], constraints: ConstraintV1): RankedResult[] {
  return results
    .map((result) => {
      const scoreBreakdown = score(result, constraints);
      return { ...result, score: scoreBreakdown.total, scoreBreakdown };
    })
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name, "zh-Hant"));
}

/** Keep the strongest choices while avoiding an identical opening character dominating the list. */
export function diversityRerank(results: RankedResult[], limit: number): RankedResult[] {
  const selected: RankedResult[] = [];
  const deferred: RankedResult[] = [];
  const seenFirst = new Set<string>();
  for (const result of results) {
    const first = result.characters[0]?.char;
    if (first && seenFirst.has(first)) deferred.push(result);
    else {
      selected.push(result);
      if (first) seenFirst.add(first);
    }
    if (selected.length === limit) return selected;
  }
  return [...selected, ...deferred].slice(0, limit);
}

export function featureFacts(character: Character): string[] {
  return [
    `稀有度：${character.rarityBand ?? "尚無資料"}`,
    `輸入難度：${character.inputDifficulty === undefined ? "尚無資料" : `${Math.round(character.inputDifficulty * 100)}%`}`,
    ...character.tags.map((tag) => `風格：${tag}`)
  ];
}

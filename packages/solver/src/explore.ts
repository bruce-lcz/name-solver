import { isStrokeMatch, type Character, type ConstraintV1 } from "../../domain/src/index.ts";
import { score, type RankedResult, type ScoreBreakdown } from "../../ranking/src/index.ts";
import { checkCharacter, type StageCounts } from "./index.ts";

type Group = { id: number; position: number; chars: Character[]; members: Set<string>; missing: string[]; stroke?: number };
type Block = { groups: Group[]; repeated: boolean; count: number; score: number };
export interface PoolCandidate {
  character: Character;
  matchingCombinations: number;
  pendingCombinations: number;
  missing: string[];
  score?: number;
  bestName?: string;
  scoreBreakdown?: ScoreBreakdown;
}

const product = (values: number[]) => values.reduce((a, b) => a * b, 1);
const codeOrder = (a: Character, b: Character) => a.char.codePointAt(0)! - b.char.codePointAt(0)!;

/** Group equivalent scores and stroke values, never materialize the Cartesian product.
 * For <=3 positions, inclusion/exclusion counts repeated characters exactly.
 * Each ranked block can be addressed directly even billions of names into a page.
 */
export class SearchIndex {
  readonly constraints: ConstraintV1;
  readonly groups: Group[][];
  readonly blocks: Block[] = [];
  readonly counts: StageCounts;
  pendingCombinations = 0;
  private intersections = new Map<string, number>();
  private matched = new Map<number, number>();
  private pending = new Map<number, number>();
  private missing = new Map<number, Set<string>>();
  private byGroup = new Map<number, Block[]>();

  constructor(constraints: ConstraintV1, characters: Character[]) {
    this.constraints = constraints;
    let id = 0;
    const rejected: StageCounts["rejectedByRule"] = {};
    this.groups = constraints.positions.map((position, index) => {
      const groups = new Map<string, Group>();
      for (const character of characters) {
        const check = checkCharacter(character, index, position, constraints.hardExcludedChars);
        for (const reason of check.failures) rejected[reason] = (rejected[reason] ?? 0) + 1;
        if (check.failures.some(reason => reason !== "missing_strokes" && reason !== "missing_element")) continue;
        const missing = check.failures.map(reason => reason === "missing_strokes"
          ? `名字第 ${index + 1} 字缺${position.strokeSystem === "kangxi" ? "康熙" : "現代"}筆畫`
          : `名字第 ${index + 1} 字缺${position.element?.school === "radical" ? "部首" : "數理"}五行資料`);
        const stroke = character.strokes[position.strokeSystem];
        if (constraints.totalStrokes && stroke === undefined && !check.failures.includes("missing_strokes")) {
          missing.push(`總筆畫需要名字第 ${index + 1} 字的${position.strokeSystem === "kangxi" ? "康熙" : "現代"}筆畫`);
        }
        const single = this.result([character]);
        const key = JSON.stringify([constraints.totalStrokes ? stroke : null, missing,
          single.scoreBreakdown.rarity, single.scoreBreakdown.style,
          constraints.preferences.avoidDifficultCharacters ? character.inputDifficulty : null,
          single.scoreBreakdown.softExclusions, single.scoreBreakdown.negativeHomophones]);
        let group = groups.get(key);
        if (!group) {
          group = { id: id++, position: index, chars: [], members: new Set(), missing, stroke };
          groups.set(key, group);
        }
        group.chars.push(character); group.members.add(character.char);
      }
      return [...groups.values()].map(group => ({ ...group, chars: group.chars.sort(codeOrder) }));
    });
    this.counts = {
      inputCharacters: characters.length,
      positionCandidates: this.groups.map(groups => groups.filter(g => !g.missing.length).reduce((n, g) => n + g.chars.length, 0)),
      combinations: 0, hardConstraintMatches: 0, rejectedByRule: rejected
    };
    this.counts.combinations = product(this.groups.map(groups => groups.reduce((n, g) => n + g.chars.length, 0)));
    const visit = (prefix: Group[]) => {
      if (prefix.length < this.groups.length) {
        for (const group of this.groups[prefix.length]) visit([...prefix, group]);
        return;
      }
      const count = product(prefix.map(g => g.chars.length));
      const missing = prefix.flatMap(g => g.missing);
      if (constraints.totalStrokes && prefix.every(g => g.stroke !== undefined)
        && !isStrokeMatch(prefix.reduce((sum, g) => sum + g.stroke!, 0), constraints.totalStrokes)) {
        rejected.total_strokes = (rejected.total_strokes ?? 0) + count;
        return;
      }
      for (const group of prefix) {
        const target = missing.length ? this.pending : this.matched;
        if (!missing.length || group.missing.length) {
          target.set(group.id, (target.get(group.id) ?? 0) + count / group.chars.length);
        }
        if (missing.length && group.missing.length) {
          const reasons = this.missing.get(group.id) ?? new Set<string>();
          for (const reason of group.missing) reasons.add(reason);
          this.missing.set(group.id, reasons);
        }
      }
      if (missing.length) { this.pendingCombinations += count; return; }
      this.counts.hardConstraintMatches += count;
      const distinct = this.distinctCount(prefix, []);
      const base = this.result(prefix.map(g => g.chars[0]));
      const baseScore = base.score - base.scoreBreakdown.repetition;
      if (distinct) this.blocks.push({ groups: prefix, repeated: false, count: distinct, score: baseScore });
      if (count > distinct) this.blocks.push({ groups: prefix, repeated: true, count: count - distinct, score: baseScore - 15 });
    };
    visit([]);
    this.blocks.sort((a, b) => b.score - a.score);
    for (const block of this.blocks) for (const group of block.groups) {
      const list = this.byGroup.get(group.id) ?? [];
      list.push(block); this.byGroup.set(group.id, list);
    }
  }

  private intersection(groups: Group[], used: string[]): number {
    const key = groups.map(g => g.id).sort((a, b) => a - b).join(",");
    let count = this.intersections.get(key);
    if (count === undefined) {
      const smallest = groups.reduce((a, b) => a.chars.length < b.chars.length ? a : b);
      count = smallest.chars.filter(c => groups.every(g => g.members.has(c.char))).length;
      this.intersections.set(key, count);
    }
    return count - used.filter(char => groups.every(g => g.members.has(char))).length;
  }

  private distinctCount(groups: Group[], used: string[]): number {
    if (new Set(used).size !== used.length) return 0;
    if (!groups.length) return 1;
    const sizes = groups.map(g => g.chars.length - used.filter(c => g.members.has(c)).length);
    if (groups.length === 1) return sizes[0];
    if (groups.length === 2) return sizes[0] * sizes[1] - this.intersection(groups, used);
    return product(sizes) - this.intersection([groups[0], groups[1]], used) * sizes[2]
      - this.intersection([groups[0], groups[2]], used) * sizes[1]
      - this.intersection([groups[1], groups[2]], used) * sizes[0]
      + 2 * this.intersection(groups, used);
  }

  private completions(groups: Group[], chosen: string[], repeated: boolean): number {
    const distinct = this.distinctCount(groups, chosen);
    return repeated ? product(groups.map(g => g.chars.length)) - distinct : distinct;
  }

  private select(block: Block, offset: number, fixed?: { position: number; character: Character }): Character[] {
    const result: Character[] = [];
    const chosen = fixed ? [fixed.character.char] : [];
    for (let i = 0; i < block.groups.length; i++) {
      if (i === fixed?.position) { result.push(fixed.character); continue; }
      const remaining = block.groups.filter((_, index) => index > i && index !== fixed?.position);
      for (const character of block.groups[i].chars) {
        const count = this.completions(remaining, [...chosen, character.char], block.repeated);
        if (offset >= count) { offset -= count; continue; }
        result.push(character); chosen.push(character.char); break;
      }
    }
    return result;
  }

  result(characters: Character[]): RankedResult {
    const strokes = characters.map((c, i) => c.strokes[this.constraints.positions[i].strokeSystem]);
    const result = {
      name: this.constraints.surname + characters.map(c => c.char).join(""), characters,
      totalStrokes: strokes.every((s): s is number => s !== undefined) ? strokes.reduce((a, b) => a + b, 0) : undefined,
      constraintMatch: true as const,
      checks: characters.map((c, i) => checkCharacter(c, i, this.constraints.positions[i], this.constraints.hardExcludedChars))
    };
    const scoreBreakdown = score(result, this.constraints);
    return { ...result, scoreBreakdown, score: scoreBreakdown.total };
  }

  page(offset: number, limit: number): RankedResult[] {
    const results: RankedResult[] = [];
    for (const block of this.blocks) {
      if (offset >= block.count) { offset -= block.count; continue; }
      while (offset < block.count && results.length < limit) results.push(this.result(this.select(block, offset++)));
      if (results.length === limit) break;
      offset = 0;
    }
    return results;
  }

  pool(position: number, status: "eligible" | "pending", offset: number, limit: number, search = "") {
    const candidates: Array<{ character: Character; group: Group; block?: Block }> = [];
    for (const group of this.groups[position]) {
      const matches = this.matched.get(group.id) ?? 0;
      const pending = this.pending.get(group.id) ?? 0;
      if (status === "eligible" ? !matches : matches > 0 || !pending) continue;
      for (const character of group.chars) {
        if (search && !character.char.includes(search)) continue;
        const block = status === "eligible" ? this.byGroup.get(group.id)?.find(b =>
          this.completions(b.groups.filter(g => g.position !== position), [character.char], b.repeated) > 0) : undefined;
        candidates.push({ character, group, block });
      }
    }
    candidates.sort((a, b) => (b.block?.score ?? 0) - (a.block?.score ?? 0) || codeOrder(a.character, b.character));
    const items: PoolCandidate[] = candidates.slice(offset, offset + limit).map(({ character, group, block }) => {
      const best = block ? this.result(this.select(block, 0, { position, character })) : undefined;
      return {
        character, matchingCombinations: this.matched.get(group.id) ?? 0,
        pendingCombinations: this.pending.get(group.id) ?? 0,
        missing: [...(this.missing.get(group.id) ?? [])], score: best?.score,
        bestName: best?.name, scoreBreakdown: best?.scoreBreakdown
      };
    });
    return { items, total: candidates.length, offset, nextOffset: offset + items.length < candidates.length ? offset + items.length : null };
  }
}

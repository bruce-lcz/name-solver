import { describe, expect, it } from "vitest";
import { solveName } from "../apps/web/src/lib/service.ts";

const openConstraints = {
  schemaVersion: 1 as const,
  surname: "陳",
  givenNameLength: 2 as const,
  positions: [{ strokeSystem: "modern" as const }, { strokeSystem: "modern" as const }],
  preferences: { styles: [], avoidNegativeHomophones: false, avoidDifficultCharacters: false }
};

describe("bidirectional character exploration", () => {
  it("searches the full CNS pool and paginates ranked combinations", () => {
    const first = solveName(openConstraints, undefined, 4, { fixedCharacters: [null, null], poolLimit: 4 });
    const second = solveName(openConstraints, undefined, 4, { offset: 4, fixedCharacters: [null, null], poolLimit: 4 });
    expect(first.counts.hardConstraintMatches).toBeGreaterThan(100);
    expect(first.pools[0].total).toBeGreaterThan(100);
    expect(second.results.map((result) => result.name)).not.toEqual(first.results.map((result) => result.name));
  });

  it("uses either position as the fixed starting point", () => {
    const response = solveName(openConstraints, undefined, 3, { fixedCharacters: ["沐", null], poolLimit: 3 });
    expect(response.results.every((result) => result.characters[0]?.char === "沐")).toBe(true);
    expect(response.pools[0].items[0]?.character.char).toBe("沐");
    expect(response.pools[1].items).toHaveLength(3);
  });

  it("keeps unknown metadata visible as a pending pool", () => {
    const response = solveName({
      ...openConstraints,
      positions: [
        { strokeSystem: "kangxi" as const, strokes: { values: [8] }, element: { school: "radical" as const, values: ["water" as const] } },
        { strokeSystem: "kangxi" as const, strokes: { values: [6] }, element: { school: "radical" as const, values: ["earth" as const] } }
      ]
    }, undefined, 3, { fixedCharacters: [null, null], poolLimit: 3 });
    expect(response.pendingCombinations).toBeGreaterThan(0);
    expect(response.pendingPools.some((pool) => pool.total > 0)).toBe(true);
  });
});

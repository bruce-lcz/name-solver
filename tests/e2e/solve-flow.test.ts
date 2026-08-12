import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { postSolve } from "../../apps/web/src/app/api/v1/solve/route.ts";
import { diagnoseName } from "../../apps/web/src/lib/service.ts";

describe("closed beta critical journey", () => {
  it("validates, solves, ranks, and explains an example request", () => {
    const response = postSolve({
      constraints: {
        schemaVersion: 1, surname: "陳", givenNameLength: 2,
        positions: [
          { strokeSystem: "kangxi", strokes: { values: [8] }, element: { school: "radical", values: ["water"] } },
          { strokeSystem: "kangxi", strokes: { values: [6] }, element: { school: "radical", values: ["earth"] } }
        ],
        totalStrokes: { values: [14] },
        preferences: { styles: ["gentle"], avoidNegativeHomophones: true, avoidDifficultCharacters: true }
      },
      characters: undefined,
      limit: 10
    });
    expect(response.status).toBe(200);
    if (response.status !== 200) throw new Error("unexpected response");
    expect(response.body.results[0]).toMatchObject({ name: "陳沐安", constraintMatch: true });
    expect(response.body.results[0].scoreBreakdown).toBeDefined();
  });

  it("offers a relaxation when no hard-constraint match exists", () => {
    const diagnostic = diagnoseName({ schemaVersion: 1, surname: "陳", givenNameLength: 1, positions: [{ strokeSystem: "kangxi", strokes: { values: [99] } }] });
    expect(diagnostic.suggestion).toContain("positions.0.strokes");
  });

  it("keeps each reviewed gold-set expectation eligible", () => {
    const gold = JSON.parse(readFileSync(resolve(process.cwd(), "data/reviewed/gold-set.v1.json"), "utf8")) as { cases: Array<{ constraints: unknown; expectedNames: string[] }> };
    for (const testCase of gold.cases) {
      const response = postSolve({ constraints: testCase.constraints, limit: 100 });
      expect(response.status).toBe(200);
      if (response.status === 200) {
        const actual = response.body.results.map((result) => result.name);
        for (const expected of testCase.expectedNames) expect(actual).toContain(expected);
      }
    }
  });
});

import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { resolve } from "node:path";
import { constraintsV1Schema } from "../packages/domain/src/index.ts";
import { solve } from "../packages/solver/src/index.ts";
import { postSolve } from "../apps/web/src/app/api/v1/solve/route.ts";
import { rank, diversityRerank } from "../packages/ranking/src/index.ts";
import { diagnose } from "../packages/diagnostics/src/index.ts";
import { importCharacterRelease } from "../packages/data-pipeline/src/index.ts";
import { characters as fixtureCharacters } from "../apps/web/src/lib/catalog.ts";

const characters = [
  { char: "沐", strokes: { kangxi: 8 }, elements: { radical: "water" }, rarityBand: "uncommon" },
  { char: "安", strokes: { kangxi: 6 }, elements: { radical: "earth" } },
  { char: "林", strokes: { kangxi: 8 }, elements: { radical: "wood" } },
  { char: "炎", strokes: { kangxi: 8 }, elements: { radical: "fire" } }
];

describe("solve", () => {
  it("returns only combinations that satisfy every hard condition", () => {
    const response = solve(
      {
        schemaVersion: 1,
        surname: "陳",
        givenNameLength: 2,
        positions: [
          { strokeSystem: "kangxi", strokes: { values: [8] }, element: { school: "radical", values: ["water"] } },
          { strokeSystem: "kangxi", strokes: { min: 6, max: 6 }, element: { school: "radical", values: ["earth"] } }
        ],
        totalStrokes: { values: [14] },
        hardExcludedChars: ["炎"]
      },
      characters
    );

    expect(response.results).toHaveLength(1);
    expect(response.results[0]).toMatchObject({ name: "陳沐安", totalStrokes: 14, constraintMatch: true });
    expect(response.counts).toMatchObject({ positionCandidates: [1, 1], combinations: 1, hardConstraintMatches: 1 });
  });

  it("rejects malformed constraint contracts before searching", () => {
    expect(() => solve({ schemaVersion: 1, surname: "陳", givenNameLength: 2, positions: [] }, characters)).toThrow(
      "Array must contain at least 1 element"
    );
  });

  it("exposes malformed API requests as a 400 response", () => {
    const response = postSolve({
      constraints: { schemaVersion: 1, surname: "陳", givenNameLength: 2, positions: [] },
      characters
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: "invalid_request" });
  });

  it("counts every hard match even when its result page is limited", () => {
    const response = solve({ schemaVersion: 1, surname: "陳", givenNameLength: 1, positions: [{ strokeSystem: "kangxi" }] }, characters, 1);
    expect(response.results).toHaveLength(1);
    expect(response.counts.hardConstraintMatches).toBe(characters.length);
  });

  it("never returns an explicitly hard-excluded character (property test)", () => {
    fc.assert(fc.property(fc.constantFrom(...characters.map((character) => character.char)), (excluded) => {
      const response = solve({ schemaVersion: 1, surname: "陳", givenNameLength: 1, positions: [{ strokeSystem: "kangxi" }], hardExcludedChars: [excluded] }, characters);
      return response.results.every((result) => !result.name.includes(excluded));
    }));
  });

  it("ranks only already-valid results and diversifies their first character", () => {
    const constraints = constraintsV1Schema.parse({ schemaVersion: 1, surname: "陳", givenNameLength: 1, positions: [{ strokeSystem: "kangxi" }], preferences: { styles: ["modern"], avoidNegativeHomophones: false, avoidDifficultCharacters: true } });
    const solved = solve(constraints, characters);
    const reranked = diversityRerank(rank(solved.results, constraints), 3);
    expect(reranked).toHaveLength(3);
    expect(reranked.every((result) => result.constraintMatch)).toBe(true);
  });

  it("diagnoses the single hard rule whose relaxation restores candidates", () => {
    const diagnosis = diagnose({ schemaVersion: 1, surname: "陳", givenNameLength: 1, positions: [{ strokeSystem: "kangxi", strokes: { values: [99] } }] }, characters);
    expect(diagnosis.counts.hardConstraintMatches).toBe(0);
    expect(diagnosis.relaxations[0]).toMatchObject({ rule: "positions.0.strokes" });
  });

  it("imports and validates the reviewed development dataset", async () => {
    const source = resolve(process.cwd(), "data/fixtures/characters.v1.json");
    const imported = await importCharacterRelease(source);
    expect(imported.report).toMatchObject({ validCharacters: 50, invalidRows: [], duplicateCharacters: [] });
    expect(fixtureCharacters).toHaveLength(50);
  });
});

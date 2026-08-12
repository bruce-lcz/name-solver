import { describe, expect, it } from "vitest";
import { extractCnsVersion } from "../packages/data-pipeline/src/cns11643.ts";

describe("CNS11643 crawler", () => {
  it("uses the date version declared by the official release file", () => {
    expect(extractCnsVersion("檔案名稱：release.txt\n版本：20260805\n")).toBe("20260805");
  });

  it("rejects a release file with no verifiable version", () => {
    expect(() => extractCnsVersion("unversioned")).toThrow("does not contain");
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type Fixture = {
  id: string;
  input: string;
  context: unknown;
  expected: { type: string; anchors: string[]; transaction?: null };
};
const fixtures = JSON.parse(readFileSync("tests/fixtures/decision-extraction.json", "utf8")) as Fixture[];

describe("decision extraction evaluation fixtures", () => {
  it("covers the five required context and grounding cases", () => {
    expect(fixtures.map(({ id }) => id)).toEqual(["A", "B", "C", "D", "E"]);
    expect(fixtures.every(({ input, expected }) => input.trim() && expected.anchors.length > 0)).toBe(true);
    expect(fixtures.find(({ id }) => id === "A")?.context).toMatchObject({ linkedTransaction: { quantity: 100, price: 2850 } });
    expect(fixtures.find(({ id }) => id === "B")?.context).toMatchObject({ pastDecisions: ["次の決算を確認してから追加を考える"] });
    expect(fixtures.find(({ id }) => id === "D")?.expected.transaction).toBeNull();
    expect(fixtures.find(({ id }) => id === "E")?.context).toMatchObject({ linkedTransaction: { quantity: 200 } });
  });
});

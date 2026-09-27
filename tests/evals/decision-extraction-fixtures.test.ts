import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type Fixture = {
  id: string;
  input: string;
  expected: {
    type: string;
    name: string;
    ticker: string | null;
    thesis: string | null;
    reviewCondition: string | null;
    addCondition: string | null;
    transaction?: { quantity: number | null; price: number | null };
  };
};

const fixtures = JSON.parse(
  readFileSync("tests/fixtures/decision-extraction.json", "utf8"),
) as Fixture[];

describe("decision extraction evaluation fixtures", () => {
  it("covers 10 to 20 distinct Japanese capture examples and all decision types", () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(10);
    expect(fixtures.length).toBeLessThanOrEqual(20);
    expect(new Set(fixtures.map(({ id }) => id)).size).toBe(fixtures.length);
    expect(new Set(fixtures.map(({ expected }) => expected.type))).toEqual(
      new Set([
        "buy",
        "add",
        "sell_consideration",
        "sell",
        "thesis_update",
        "note",
      ]),
    );
    expect(fixtures.every(({ input, expected }) => input.trim() && expected.name.trim())).toBe(true);
  });

  it("includes a 100-share purchase with no price in the source text or expected result", () => {
    const caseForUnknownPrice = fixtures.find(({ id }) => id === "kioxia-buy-price-unknown");

    expect(caseForUnknownPrice?.input).toContain("100株買った");
    expect(caseForUnknownPrice?.input).not.toContain("円");
    expect(caseForUnknownPrice?.expected.transaction).toEqual({ quantity: 100, price: null });
  });
});

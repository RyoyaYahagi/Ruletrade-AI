import { readFile } from "node:fs/promises";

import { extractDecision } from "@/lib/ai/gemini";
import { DecisionExtractionSchema } from "@/schemas/decision";

type EvalCase = {
  id: string;
  input: string;
  expected: {
    type: string;
    name: string;
    ticker: string | null;
    thesis: string | null;
    reviewCondition: string | null;
    addCondition: string | null;
  };
};

function containsExpected(value: string | null, expected: string | null) {
  return expected === null ? value === null : value?.includes(expected) ?? false;
}

function listContainsExpected(values: string[], expected: string | null) {
  return expected === null
    ? values.length === 0
    : values.some((value) => value.includes(expected));
}

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Set GEMINI_API_KEY before running this paid, live Gemini evaluation.");
  }
  if (!process.env.GEMINI_MODEL) {
    throw new Error("Set GEMINI_MODEL before running this paid, live Gemini evaluation.");
  }

  const cases = JSON.parse(
    await readFile("tests/fixtures/decision-extraction.json", "utf8"),
  ) as EvalCase[];
  const metrics = {
    type: { passed: 0, total: cases.length },
    tickerCompany: { passed: 0, total: cases.length },
    thesis: { passed: 0, total: cases.length },
    reviewCondition: { passed: 0, total: cases.length },
    addCondition: { passed: 0, total: cases.length },
    schemaValid: { passed: 0, total: cases.length },
  };

  for (const evalCase of cases) {
    const errors: string[] = [];
    try {
      const extraction = DecisionExtractionSchema.parse(
        await extractDecision({ rawInput: evalCase.input }),
      );
      metrics.schemaValid.passed++;
      const checks = {
        type: extraction.type === evalCase.expected.type,
        tickerCompany:
          extraction.stock.name === evalCase.expected.name &&
          extraction.stock.ticker === evalCase.expected.ticker,
        thesis: containsExpected(extraction.thesis, evalCase.expected.thesis),
        reviewCondition: listContainsExpected(
          extraction.reviewConditions,
          evalCase.expected.reviewCondition,
        ),
        addCondition: listContainsExpected(
          extraction.addConditions,
          evalCase.expected.addCondition,
        ),
      };
      for (const [field, passed] of Object.entries(checks)) {
        if (passed) metrics[field as keyof typeof checks].passed++;
        else errors.push(field);
      }
    } catch (error) {
      errors.push(
        error instanceof Error ? `schema/API: ${error.message}` : "schema/API: unknown error",
      );
    }
    if (errors.length) console.log(`${evalCase.id}: ${errors.join(", ")}`);
  }

  console.log(`Gemini extraction evaluation (${cases.length} fixture cases)`);
  for (const [field, result] of Object.entries(metrics)) {
    const percent = result.total === 0 ? 0 : Math.round((result.passed / result.total) * 100);
    console.log(`${field}: ${result.passed}/${result.total} (${percent}%)`);
  }

  if (metrics.schemaValid.passed !== metrics.schemaValid.total) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

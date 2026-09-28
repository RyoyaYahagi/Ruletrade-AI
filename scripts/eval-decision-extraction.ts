import { readFile } from "node:fs/promises";
import { extractDecision } from "@/lib/ai/gemini";
import { DecisionExtractionSchema } from "@/schemas/decision";

type Fixture = { id: string; input: string; context: unknown; expected: { type: string; anchors: string[]; forbiddenPoints?: string[]; forbiddenPointPattern?: string; transaction?: null } };

async function main() {
  if (!process.env.GEMINI_API_KEY || !process.env.GEMINI_MODEL) throw new Error("Set GEMINI_API_KEY and GEMINI_MODEL before running the live Gemini evaluation.");
  const cases = JSON.parse(await readFile("tests/fixtures/decision-extraction.json", "utf8")) as Fixture[];
  const totals = { schemaValid: 0, coreMeaningPreserved: 0, noFabrication: 0, factConsistency: 0, sourceGrounding: 0, noForcedCategory: 0, followUpQuality: 0 };
  for (const item of cases) {
    const output = DecisionExtractionSchema.parse(await extractDecision({ rawInput: item.input, context: item.context }));
    totals.schemaValid++;
    if (output.type === item.expected.type) totals.coreMeaningPreserved++;
    const pointText = output.points.map((point) => point.text).join(" ");
    const sourceGrounded = output.points.every((point) => item.expected.anchors.some((anchor) => point.text.includes(anchor)));
    if (sourceGrounded) totals.sourceGrounding++;
    const forbiddenPattern = item.expected.forbiddenPointPattern ? new RegExp(item.expected.forbiddenPointPattern) : null;
    const containsForbidden = item.expected.forbiddenPoints?.some((fact) => pointText.includes(fact)) ?? false;
    if (sourceGrounded && !containsForbidden && !(forbiddenPattern && forbiddenPattern.test(pointText))) totals.noFabrication++;
    const factConsistent = !containsForbidden && (item.expected.transaction !== null || output.transaction === null);
    if (factConsistent) totals.factConsistency++;
    if ((item.id !== "C" || output.points.length === 0 || sourceGrounded) && (item.id !== "D" || output.transaction === null)) totals.noForcedCategory++;
    const questionValid = output.followUpQuestion === null || output.followUpQuestion.length <= 500;
    if (questionValid) totals.followUpQuality++;
    console.log(`${item.id}: type=${output.type}, points=${output.points.length}, followUp=${Boolean(output.followUpQuestion)}`);
  }
  console.log(`Gemini decision recording evaluation (${cases.length} cases). Free-text meaning and subtle fabrication still require manual review; deterministic checks cover explicit source anchors, forbidden Context facts, and transaction presence. A follow-up question is optional, including for conflicting facts.`);
  for (const [metric, passed] of Object.entries(totals)) console.log(`${metric}: ${passed}/${cases.length}`);
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });

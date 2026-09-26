import {
  decisionDraftSchema,
  reviewComparisonSchema,
  type Decision,
  type DecisionDraft,
  type ReviewComparison,
} from "@/lib/domain";

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: { message?: string };
};

function config() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  return {
    apiKey,
    model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
  };
}

async function generateJson(parts: GeminiPart[]) {
  const { apiKey, model } = config();
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      }),
      cache: "no-store",
    },
  );

  const payload = (await response.json()) as GeminiResponse;
  if (!response.ok) {
    throw new Error(payload.error?.message || "Gemini request failed.");
  }

  const text = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();

  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  return JSON.parse(stripCodeFence(text)) as unknown;
}

function stripCodeFence(value: string) {
  return value
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
}

const structureInstruction = `
You are structuring a Japanese user's own investment note.
Do not recommend buying or selling. Do not evaluate whether the investment is good.

Return JSON with exactly these fields:
- ticker: string or null. Only use a ticker/code if the user explicitly said it or it is clearly present in the note. Do not invent one.
- companyName: string or null
- kind: one of "buy", "add", "sell", "review", "note"
- rawText: the user's original wording. For audio, transcribe the Japanese speech faithfully and put the transcript here.
- thesis: concise description of why the user holds/bought/is considering the stock, or null
- assumptions: string[]
- exitConditions: string[] describing conditions the USER said would make them reconsider/sell
- addConditions: string[] describing conditions the USER said would make them consider adding

Do not create conditions the user did not state.
Keep uncertainty. If something was not said, use null or [].
`.trim();

export async function structureDecisionText(text: string): Promise<DecisionDraft> {
  const raw = await generateJson([
    {
      text: `${structureInstruction}\n\nUser note:\n${text}`,
    },
  ]);
  return decisionDraftSchema.parse({ ...(raw as object), rawText: text });
}

export async function structureDecisionAudio(
  audio: Buffer,
  mimeType: string,
): Promise<DecisionDraft> {
  const raw = await generateJson([
    {
      inlineData: {
        mimeType,
        data: audio.toString("base64"),
      },
    },
    {
      text: `${structureInstruction}\n\nFirst transcribe the audio faithfully, then structure only what was actually said.`,
    },
  ]);
  return decisionDraftSchema.parse(raw);
}

export async function compareWithHistory(
  ticker: string,
  decisions: Decision[],
  currentText: string,
): Promise<ReviewComparison> {
  const history = decisions.map((decision) => ({
    date: decision.createdAt,
    kind: decision.kind,
    originalNote: decision.rawText,
    thesis: decision.thesis,
    assumptions: decision.assumptions,
    exitConditions: decision.exitConditions,
    addConditions: decision.addConditions,
  }));

  const raw = await generateJson([
    {
      text: `
You are reviewing one person's investment-decision journal for ${ticker}.

Your job is ONLY to compare what the person says now with what the same person recorded before.
Do not recommend buying, selling, holding, price targets, position sizes, or trades.
Do not claim whether external facts are true because you do not have market/news data.

Past journal:
${JSON.stringify(history, null, 2)}

What the user says now:
${currentText}

Return JSON with exactly:
- summary: concise comparison
- unchanged: string[] of ideas that remain consistent
- changed: string[] of ideas that differ from earlier notes
- unclear: string[] of assumptions whose current status cannot be determined from the user's notes
- question: string or null; ask at most one useful question that would clarify the biggest change
`.trim(),
    },
  ]);

  return reviewComparisonSchema.parse(raw);
}

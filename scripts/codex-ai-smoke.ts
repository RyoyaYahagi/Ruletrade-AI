import { config } from "dotenv";
import OpenAI from "openai";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

const DEFAULT_CODEX_MODEL = "gpt-5.2-codex";

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. Add it to .env.local or export it before running this script.",
    );
  }

  const model = process.env.OPENAI_CODEX_MODEL || DEFAULT_CODEX_MODEL;
  const prompt =
    process.argv.slice(2).join(" ").trim() ||
    "Ruletrade-AI のMVPで次に追加すべき安全性テストを3つ、日本語で短く提案してください。";

  const client = new OpenAI({ apiKey });
  const response = await client.responses.create({
    model,
    input: [
      "You are a development-only coding assistant for Ruletrade-AI.",
      "Do not provide investment advice.",
      "Focus on implementation, tests, and safety boundaries.",
      "",
      prompt,
    ].join("\n"),
    max_output_tokens: 800,
  });

  console.log(response.output_text);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

import "server-only";
import { z } from "zod";
import {
  feedbackMetadataSchema,
  type FeedbackClassification,
  type FeedbackInput,
} from "@/schemas/feedback";

const issueEndpoint =
  "https://api.github.com/repos/RyoyaYahagi/Ruletrade-AI/issues";
const issueSchema = z.object({ number: z.number().int().positive() });
const categoryLabels = {
  bug: "feedback:bug",
  ux_problem: "feedback:ux",
  feature_request: "feedback:feature",
  data_problem: "feedback:data",
  question: "feedback:question",
  other: null,
};

export function formatFeedbackIssue(
  input: FeedbackInput,
  classification: FeedbackClassification,
) {
  const metadata = feedbackMetadataSchema.parse({
    ...classification,
    inputMethod: input.inputMethod,
  });
  const excerpt = Array.from(input.message.replace(/\s+/gu, " ").trim())
    .slice(0, 50)
    .join("");
  const title = `[Feedback]${classification.classificationSource === "jev" ? `[${classification.category}]` : ""} ${excerpt}`;
  const classificationText =
    classification.classificationSource === "jev"
      ? `- Category: \`${classification.category}\`\n- Area: \`${classification.area}\`\n- Severity: \`${classification.severity}\`\n- Needs clarification: \`${classification.needsClarification}\`\n- Classification source: \`jev\``
      : "Jevによる分類を利用できませんでした。\n\n- Category: `other`\n- Area: `unknown`\n- Classification source: `none`";
  const body = `## 問い合わせ内容\n\n${input.message}\n\n## 分類\n\n${classificationText}\n\n## 入力方法\n\n- ${input.inputMethod}\n\n<!-- ruletrade-feedback:v1\n${JSON.stringify(metadata, null, 2)}\n-->`;
  return { title, body };
}

export async function createFeedbackIssue(
  input: FeedbackInput,
  classification: FeedbackClassification,
) {
  const token = process.env.GITHUB_FEEDBACK_TOKEN;
  if (!token) throw new Error("GitHub feedback is not configured");
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2026-03-10",
  };
  // Create without labels first so label permissions or missing labels cannot lose a report.
  const response = await fetch(issueEndpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(formatFeedbackIssue(input, classification)),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("GitHub issue creation failed");
  const { number } = issueSchema.parse(await response.json());
  const label =
    classification.classificationSource === "jev"
      ? categoryLabels[classification.category]
      : null;
  try {
    await fetch(`${issueEndpoint}/${number}/labels`, {
      method: "POST",
      headers,
      body: JSON.stringify({ labels: ["feedback", ...(label ? [label] : [])] }),
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    // Metadata in the already-created issue is authoritative; labels are optional.
  }
  return {
    number,
    url: `https://github.com/RyoyaYahagi/Ruletrade-AI/issues/${number}`,
  };
}

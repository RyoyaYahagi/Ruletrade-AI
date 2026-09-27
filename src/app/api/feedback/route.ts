import { feedbackInputSchema } from "@/schemas/feedback";
import { classifyFeedback } from "@/lib/feedback/classify";
import { createFeedbackIssue } from "@/lib/feedback/github";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    .trim();
  const host =
    forwardedHost || request.headers.get("host") || new URL(request.url).host;
  const originUrl = origin && URL.canParse(origin) ? new URL(origin) : null;
  if (
    request.headers.get("sec-fetch-site") === "cross-site" ||
    (origin &&
      (!originUrl ||
        !["http:", "https:"].includes(originUrl.protocol) ||
        origin !== originUrl.origin ||
        originUrl.host !== host))
  ) {
    return Response.json(
      { error: "この操作はアプリの画面から実行してください。" },
      { status: 403 },
    );
  }
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return Response.json(
      { error: "問い合わせ内容を確認してください。" },
      { status: 415 },
    );
  }
  // Bound the body before JSON parsing; 10,000 characters fit within 64 KiB.
  const reader = request.body?.getReader();
  if (!reader)
    return Response.json(
      { error: "問い合わせ内容を入力してください。" },
      { status: 400 },
    );
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 64 * 1024) {
        await reader.cancel();
        return Response.json(
          { error: "問い合わせは10,000文字以内にしてください。" },
          { status: 413 },
        );
      }
      chunks.push(value);
    }
  } catch {
    return Response.json(
      { error: "問い合わせ内容を読み取れませんでした。" },
      { status: 400 },
    );
  }
  let raw: unknown;
  try {
    raw = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return Response.json(
      { error: "問い合わせ内容を確認してください。" },
      { status: 400 },
    );
  }
  const input = feedbackInputSchema.safeParse(raw);
  if (!input.success)
    return Response.json(
      { error: "問い合わせを1〜10,000文字で入力してください。" },
      { status: 400 },
    );
  try {
    const classification = await classifyFeedback(input.data.message);
    return Response.json(await createFeedbackIssue(input.data, classification));
  } catch {
    return Response.json(
      {
        error:
          "問い合わせを送信できませんでした。入力内容を残したまま再送できます。",
      },
      { status: 502 },
    );
  }
}

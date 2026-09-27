import { importJson, JsonImportError } from "@/features/json-import/service";

export const runtime = "nodejs";
const maxBytes = 20 * 1024 * 1024;

export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  try {
    if (!request.body)
      throw new JsonImportError("JSONファイルを選択してください。");
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) {
          await reader.cancel();
          return Response.json(
            { error: "JSONファイルは20MB以内にしてください。" },
            { status: 413, headers },
          );
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    let value: unknown;
    try {
      value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      throw new JsonImportError(
        "JSONファイルを読み込めませんでした。ファイルの内容を確認してください。",
      );
    }
    return Response.json(importJson(value), { headers });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof JsonImportError
            ? error.message
            : "JSONをインポートできませんでした。取り込みは行いませんでした。",
      },
      { status: error instanceof JsonImportError ? 400 : 500, headers },
    );
  }
}

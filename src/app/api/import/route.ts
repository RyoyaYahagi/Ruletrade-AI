import {
  importCsv,
  previewCsv,
  undoImport,
} from "@/features/csv-import/service";

export const runtime = "nodejs";
const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    // The HTTPS proxy forwards to HTTP on loopback, so request.url is internal.
    // Compare the browser's host (including its port) with the forwarded host.
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
          !["https:", "http:"].includes(originUrl.protocol) ||
          origin !== originUrl.origin ||
          originUrl.host !== host))
    )
      return Response.json(
        { error: "この操作はアプリの画面から実行してください。" },
        { status: 403 },
      );
    // Bound the request while streaming, before multipart parsing allocates the file.
    const reader = request.body?.getReader();
    if (!reader) throw new Error("CSVを選択してください。");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES + 64 * 1024) {
        await reader.cancel();
        return Response.json(
          { error: "CSVは10MB以下にしてください。" },
          { status: 413 },
        );
      }
      chunks.push(value);
    }
    const body = Buffer.concat(chunks);
    const form = await new Request(request.url, {
      method: "POST",
      headers: { "content-type": request.headers.get("content-type") ?? "" },
      body,
    }).formData();
    const operation = form.get("operation");
    if (operation === "undo") {
      const id = form.get("batchId");
      if (typeof id !== "string" || !id)
        throw new Error("インポート履歴を選択してください。");
      undoImport(id);
      return Response.json({ ok: true });
    }
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("CSVを選択してください。");
    if (file.size > MAX_BYTES)
      return Response.json(
        { error: "CSVは10MB以下にしてください。" },
        { status: 413 },
      );
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (operation === "preview") return Response.json(await previewCsv(bytes));
    if (operation === "import") {
      const digest = form.get("digest");
      if (typeof digest !== "string" || !digest)
        throw new Error("内容を確認してからインポートしてください。");
      const rawResolutions = form.get("resolutions");
      let resolutions: unknown = [];
      if (rawResolutions !== null) {
        if (typeof rawResolutions !== "string")
          throw new Error("取引の選択内容を読み取れませんでした。");
        try {
          resolutions = JSON.parse(rawResolutions);
        } catch {
          throw new Error("取引の選択内容を読み取れませんでした。");
        }
      }
      return Response.json(
        await importCsv(bytes, file.name, digest, resolutions),
      );
    }
    throw new Error("操作を確認してください。");
  } catch (cause) {
    return Response.json(
      {
        error:
          cause instanceof Error
            ? cause.message
            : "CSVを読み込めませんでした。",
      },
      { status: 400 },
    );
  }
}

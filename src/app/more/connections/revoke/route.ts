import { revokeIntegrationGrant } from "@/features/integration/api-keys";
import { getDb } from "@/lib/db";
import { checkBrowserWriteRequest } from "@/lib/http/browser-write-request";

export async function POST(request: Request) {
  const rejected = checkBrowserWriteRequest(request);
  if (rejected) return rejected;

  const form = await request.formData().catch(() => null);
  const id = form?.get("grant_id");
  if (typeof id !== "string" || !id) {
    return new Response("接続が指定されていません。", { status: 400 });
  }
  if (!revokeIntegrationGrant(getDb(), id)) {
    return new Response("接続が見つかりません。", { status: 404 });
  }
  return new Response(null, {
    status: 303,
    headers: { Location: "/more#connections", "Cache-Control": "no-store" },
  });
}

import { apiSuccess } from "@/lib/api/api-response";

export async function GET() {
  return apiSuccess({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}

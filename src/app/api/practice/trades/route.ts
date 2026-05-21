import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess, apiCreated } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { validateJsonRequest } from "@/lib/api/validate-request";
import { z } from "zod";
import {
  createVirtualTrade,
  listVirtualTrades,
} from "@/features/education/services/virtual-trade-service";

const CreateTradeRequestSchema = z.object({
  practice_session_id: z.string().uuid(),
  symbol: z.string().min(1).max(50),
  symbol_name: z.string().max(200).nullable().optional(),
  trade_type: z.enum(["buy", "sell"]),
  quantity: z.number().positive(),
  entry_price: z.number().positive(),
  virtual_amount: z.number().min(0),
  trade_reason: z.string().max(2000).nullable().optional(),
  rule_compliance_score: z.number().int().min(0).max(100).nullable().optional(),
  compliance_notes: z.string().max(2000).nullable().optional(),
});

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const input = await validateJsonRequest(request, CreateTradeRequestSchema);
    const result = await createVirtualTrade({ user_id: user.id, ...input });
    return apiCreated(result);
  } catch (error) {
    return toErrorResponse(error, { requestId });
  }
}

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const url = new URL(request.url);
    const practiceSessionId = url.searchParams.get("practice_session_id");
    if (!practiceSessionId) {
      throw new Error("practice_session_id query parameter is required.");
    }
    const status = url.searchParams.get("status") ?? undefined;
    const limit = url.searchParams.get("limit")
      ? Number(url.searchParams.get("limit"))
      : undefined;

    const result = await listVirtualTrades({
      practiceSessionId,
      userId: user.id,
      status: status as any,
      limit,
    });
    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, { requestId });
  }
}

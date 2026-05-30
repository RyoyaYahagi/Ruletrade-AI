import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { validateJsonRequest } from "@/lib/api/validate-request";
import { z } from "zod";
import {
  getVirtualTradeById,
  updateVirtualTrade,
  closeVirtualTrade,
  cancelVirtualTrade,
  deleteVirtualTrade,
} from "@/features/education/services/virtual-trade-service";

const UpdateTradeRequestSchema = z.object({
  trade_reason: z.string().max(2000).nullable().optional(),
  rule_compliance_score: z.number().int().min(0).max(100).nullable().optional(),
  compliance_notes: z.string().max(2000).nullable().optional(),
});

const CloseTradeRequestSchema = z.object({
  exit_price: z.number().positive(),
  exit_reason: z.string().max(2000).nullable().optional(),
});

const CancelTradeRequestSchema = z.object({
  exit_reason: z.string().max(2000).nullable().optional(),
  status: z.literal("cancelled"),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const { id } = await params;
    const result = await getVirtualTradeById(id, user.id);
    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, { requestId });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const { id } = await params;

    // Determine the intent by examining the request body
    let body: unknown;
    try {
      body = await request.clone().json();
    } catch {
      body = {};
    }

    // Check for cancel intent
    const cancelResult = CancelTradeRequestSchema.safeParse(body);
    if (cancelResult.success) {
      const result = await cancelVirtualTrade(
        id,
        user.id,
        cancelResult.data.exit_reason,
      );
      return apiSuccess(result);
    }

    // Check for close intent (has exit_price)
    const closeResult = CloseTradeRequestSchema.safeParse(body);
    if (closeResult.success) {
      const result = await closeVirtualTrade({
        tradeId: id,
        userId: user.id,
        exit_price: closeResult.data.exit_price,
        exit_reason: closeResult.data.exit_reason,
      });
      return apiSuccess(result);
    }

    // Default to regular update
    const input = await validateJsonRequest(request, UpdateTradeRequestSchema);
    const result = await updateVirtualTrade({
      tradeId: id,
      userId: user.id,
      ...input,
    });
    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, { requestId });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const { id } = await params;
    await deleteVirtualTrade(id, user.id);
    return apiSuccess({ deleted: true });
  } catch (error) {
    return toErrorResponse(error, { requestId });
  }
}

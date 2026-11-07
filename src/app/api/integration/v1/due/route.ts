import {
  authorizeIntegrationRequest,
  createMethodNotAllowedHandler,
} from "@/features/integration/auth";
import {
  toDueDecision,
  toDueTransaction,
} from "@/features/integration/mappers";
import {
  internalErrorResponse,
  successResponse,
} from "@/features/integration/responses";
import { listDueDecisions, listUnlinkedTransactions } from "@/features/due/due";
import { loadBucketWarning } from "@/features/portfolio/bucket-warning-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const authError = authorizeIntegrationRequest(request, "read");
    if (authError) return authError;

    // Capture the rule's reference time once so asOf and the due decision agree.
    const asOf = new Date().toISOString();
    const [dueDecisions, unlinkedTransactions, bucketWarning] =
      await Promise.all([
        listDueDecisions(asOf),
        listUnlinkedTransactions(),
        loadBucketWarning(),
      ]);

    return successResponse({
      asOf,
      dueDecisions: dueDecisions.map(toDueDecision),
      unlinkedTransactions: unlinkedTransactions.map(toDueTransaction),
      bucketWarning,
    });
  } catch {
    return internalErrorResponse();
  }
}

const methodNotAllowed = createMethodNotAllowedHandler("read");

export {
  methodNotAllowed as POST,
  methodNotAllowed as PUT,
  methodNotAllowed as PATCH,
  methodNotAllowed as DELETE,
  methodNotAllowed as OPTIONS,
  methodNotAllowed as HEAD,
};

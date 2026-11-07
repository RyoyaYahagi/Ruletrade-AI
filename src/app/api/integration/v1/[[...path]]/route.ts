import { errorResponse } from "@/features/integration/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function notFound(): Response {
  return errorResponse("not_found");
}

export {
  notFound as GET,
  notFound as POST,
  notFound as PUT,
  notFound as PATCH,
  notFound as DELETE,
  notFound as OPTIONS,
  notFound as HEAD,
};

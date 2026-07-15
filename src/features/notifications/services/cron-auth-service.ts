import { AppError } from "@/lib/errors/app-error";

export function assertValidCronRequest(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    throw new AppError("INTERNAL_ERROR", "CRON_SECRET is not configured.", 500);
  }

  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${cronSecret}`;

  if (authHeader !== expected) {
    throw new AppError("UNAUTHORIZED", "Invalid cron secret.", 401);
  }
}

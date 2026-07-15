import "server-only";

import { getEmailProvider, EmailMessage } from "@/lib/email/email-provider";
import { createDatabaseClient } from "@/lib/db/database-client";

export async function sendEmail(message: EmailMessage) {
  const db = await createDatabaseClient();

  // Suppression check
  const { data: suppressed } = await db
    .from("email_suppressions")
    .select("email")
    .eq("email", message.to)
    .maybeSingle();
  if (suppressed) {
    await db.from("email_send_logs").insert({
      to_address: message.to,
      subject: message.subject,
      status: "suppressed",
      idempotency_key: message.idempotencyKey ?? null,
      metadata: { reason: "suppressed" },
    });
    return { id: null, status: "suppressed" };
  }

  // Idempotency check
  if (message.idempotencyKey) {
    const { data: existing } = await db
      .from("email_send_logs")
      .select("id, status")
      .eq("idempotency_key", message.idempotencyKey)
      .maybeSingle();
    if (existing) {
      return { id: existing.id, status: existing.status };
    }
  }

  const provider = getEmailProvider();
  let result: { id: string; status: string };
  let errorMessage: string | null = null;

  try {
    result = await provider.send(message);
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
    result = { id: `failed-${crypto.randomUUID()}`, status: "failed" };
  }

  await db.from("email_send_logs").insert({
    to_address: message.to,
    subject: message.subject,
    status: result.status as string,
    error_message: errorMessage,
    idempotency_key: message.idempotencyKey ?? null,
    metadata: { providerId: result.id },
  });

  return result;
}

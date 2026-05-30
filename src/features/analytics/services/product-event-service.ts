import "server-only";

import { createServerClient } from "@/lib/db/supabase-server";

export async function trackProductEvent(params: {
  userId: string;
  eventName: string;
  properties?: Record<string, unknown>;
  sessionId?: string;
}) {
  const supabase = await createServerClient();

  const { error } = await supabase.from("product_events").insert({
    user_id: params.userId,
    event_name: params.eventName,
    properties: JSON.stringify(sanitizeProperties(params.properties ?? {})),
    session_id: params.sessionId,
  });

  if (error) {
    console.error("Failed to track product event:", error);
  }
}

function sanitizeProperties(
  properties: Record<string, unknown>,
): Record<string, unknown> {
  const forbiddenKeys = [
    "ticker",
    "symbol",
    "name",
    "memo",
    "note",
    "prompt",
    "output",
    "content",
    "text",
  ];
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(properties)) {
    const lowerKey = key.toLowerCase();
    if (forbiddenKeys.some((f) => lowerKey.includes(f))) continue;
    if (typeof value === "string" && value.length > 200) {
      result[key] = value.slice(0, 200) + "...";
    } else {
      result[key] = value;
    }
  }

  return result;
}

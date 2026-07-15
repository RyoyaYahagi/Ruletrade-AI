import "server-only";

import { createHash } from "crypto";
import { createDatabaseClient } from "@/lib/db/database-client";

export function hashInviteCode(code: string) {
  return createHash("sha256").update(code.trim()).digest("hex");
}

export function generateInviteCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function redeemInviteCode(params: {
  userId: string;
  inviteCode: string;
}) {
  const db = await createDatabaseClient();
  const codeHash = hashInviteCode(params.inviteCode);
  const { data: code, error } = await db
    .from("beta_invite_codes")
    .select("*")
    .eq("code_hash", codeHash)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  if (!code) {
    throw Object.assign(new Error("Invalid invite code."), {
      code: "INVALID_INVITE_CODE",
    });
  }
  if (code.expires_at && new Date(code.expires_at) < new Date()) {
    throw Object.assign(new Error("Invite code has expired."), {
      code: "INVITE_CODE_EXPIRED",
    });
  }
  if (code.used_count >= code.max_uses) {
    throw Object.assign(new Error("Invite code usage limit exceeded."), {
      code: "INVITE_CODE_USED",
    });
  }

  const { data: existingGrant } = await db
    .from("beta_access_grants")
    .select("id")
    .eq("user_id", params.userId)
    .maybeSingle();
  if (existingGrant) {
    return { granted: true, alreadyGranted: true };
  }

  const { error: grantError } = await db
    .from("beta_access_grants")
    .insert({
      user_id: params.userId,
      cohort_id: code.cohort_id,
      access_status: "active",
      invite_code_id: code.id,
      granted_reason: "Invite code redeemed.",
      first_seen_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
    });
  if (grantError) throw grantError;

  const { error: updateError } = await db
    .from("beta_invite_codes")
    .update({ used_count: code.used_count + 1 })
    .eq("id", code.id);
  if (updateError) throw updateError;

  return { granted: true, alreadyGranted: false };
}

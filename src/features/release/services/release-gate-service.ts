import "server-only";

import { createServerClient } from "@/lib/db/supabase-server";

/**
 * release_gate_service.ts
 *
 * Evaluates all release gates / blockers for a given release plan.
 * Each gate maps to a well-known blocker key returned in the result.
 *
 * Environment variables:
 *   - RELEASE_REQUIRE_ROLLBACK_PLAN (default: "true")
 *   - RELEASE_REQUIRE_CHANGELOG    (default: "true")
 */

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type ReleaseGateResult = {
  passed: boolean;
  blockers: string[];
};

// ──────────────────────────────────────────────
// evaluateReleaseGates
// ──────────────────────────────────────────────

/**
 * Evaluate all release gates for a given release plan.
 *
 * Checks in order:
 * 1. Rollback strategy – if RELEASE_REQUIRE_ROLLBACK_PLAN is "true" and the
 *    release plan has no rollback strategy.
 * 2. Changelog entries – if RELEASE_REQUIRE_CHANGELOG is "true" and there are
 *    zero changelog entries for this release plan.
 * 3. Sensitive-change approvals – if the release touches DB migration, RLS,
 *    privacy, or billing, and no approvals exist.
 * 4. Checklist items – any items with status "failed" or "blocked".
 * 5. Open critical risks – any risk assessment with risk_level "critical" and
 *    status "open".
 *
 * @param releasePlanId - The UUID of the release plan to evaluate.
 * @returns {ReleaseGateResult} An object with a `passed` boolean and a list of
 *   blocker keys.
 */
export async function evaluateReleaseGates(
  releasePlanId: string,
): Promise<ReleaseGateResult> {
  const supabase = await createServerClient();
  const blockers: string[] = [];

  // ── 1. Fetch the release plan ──────────────────────────────────

  const { data: releasePlan, error: planErr } = await supabase
    .from("release_plans")
    .select("*")
    .eq("id", releasePlanId)
    .single();

  if (planErr) throw planErr;
  if (!releasePlan) {
    throw new Error(`Release plan with id "${releasePlanId}" not found.`);
  }

  // ── 2. Rollback strategy gate ──────────────────────────────────

  const requireRollbackPlan =
    process.env.RELEASE_REQUIRE_ROLLBACK_PLAN !== "false"; // default true

  if (requireRollbackPlan && !releasePlan.rollback_strategy) {
    blockers.push("rollback_strategy_missing");
  }

  // ── 3. Changelog entries gate ──────────────────────────────────

  const requireChangelog =
    process.env.RELEASE_REQUIRE_CHANGELOG !== "false"; // default true

  if (requireChangelog) {
    const { count: changelogCount, error: countErr } = await supabase
      .from("release_changelog_entries")
      .select("*", { count: "exact", head: true })
      .eq("release_plan_id", releasePlanId);

    if (countErr) throw countErr;

    if (changelogCount === 0) {
      blockers.push("changelog_missing");
    }
  }

  // ── 4. Sensitive-change approval gate ──────────────────────────

  const hasSensitiveChange =
    releasePlan.includes_db_migration === true ||
    releasePlan.includes_rls_change === true ||
    releasePlan.includes_privacy_change === true ||
    releasePlan.includes_billing_change === true;

  if (hasSensitiveChange) {
    const { count: approvalCount, error: approvalErr } = await supabase
      .from("release_approvals")
      .select("*", { count: "exact", head: true })
      .eq("release_plan_id", releasePlanId);

    if (approvalErr) throw approvalErr;

    if (approvalCount === 0) {
      blockers.push("approval_missing_for_sensitive_release");
    }
  }

  // ── 5. Failed / blocked checklist items gate ───────────────────

  // First get all checklists for this release plan
  const { data: checklists, error: checklistsErr } = await supabase
    .from("release_checklists")
    .select("id")
    .eq("release_plan_id", releasePlanId);

  if (checklistsErr) throw checklistsErr;

  const checklistIds = (checklists ?? []).map((cl) => cl.id);

  if (checklistIds.length > 0) {
    // Then find any items with status "failed" or "blocked" within those
    // checklists
    const { data: failedOrBlockedItems, error: itemsErr } = await supabase
      .from("release_checklist_items")
      .select("id")
      .in("checklist_id", checklistIds)
      .in("status", ["failed", "blocked"])
      .limit(1);

    if (itemsErr) throw itemsErr;

    if ((failedOrBlockedItems ?? []).length > 0) {
      blockers.push("failed_or_blocked_checklist_items");
    }
  }

  // ── 6. Open critical risk gate ─────────────────────────────────

  const { data: criticalRisks, error: risksErr } = await supabase
    .from("release_risk_assessments")
    .select("id")
    .eq("release_plan_id", releasePlanId)
    .eq("risk_level", "critical")
    .eq("status", "open");

  if (risksErr) throw risksErr;

  if ((criticalRisks ?? []).length > 0) {
    blockers.push("open_critical_release_risk");
  }

  // ── 7. Return result ─────────────────────────────────────────

  return {
    passed: blockers.length === 0,
    blockers,
  };
}

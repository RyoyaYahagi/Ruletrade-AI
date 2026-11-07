import "server-only";

import { loadBucketSummary } from "@/features/portfolio/bucket-data";
import {
  evaluateBucketWarning,
  type BucketWarning,
} from "@/features/portfolio/bucket-warning";
import type { PortfolioHolding } from "@/features/portfolio/portfolio";
import { getAppSettings } from "@/features/settings/settings";

/**
 * Returns a warning only when the market-value ratio exceeds the configured
 * line. An unset line short-circuits before fetching quotes.
 */
export async function loadBucketWarning(
  holdings?: readonly PortfolioHolding[],
): Promise<BucketWarning | null> {
  const warnPct = getAppSettings().satelliteWarnPct;
  if (warnPct === null) return null;
  const summary = await loadBucketSummary(holdings);
  return evaluateBucketWarning(summary, warnPct);
}

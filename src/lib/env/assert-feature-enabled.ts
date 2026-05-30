import "server-only";

import { AppError } from "@/lib/errors/app-error";

export function assertFeatureEnabled(featureName: string, enabled: boolean) {
  if (!enabled) {
    throw new AppError("FEATURE_DISABLED", "この機能は現在停止中です。", 503);
  }
}

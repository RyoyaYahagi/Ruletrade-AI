import { z } from "zod";

import { MAX_USER_MONTHLY_LIMIT_USD } from "@/lib/cost-limit/cost-limit-types";

export const UpdateAiUsageSettingsSchema = z.object({
  monthlyLimitUsd: z.number().min(0.1).max(MAX_USER_MONTHLY_LIMIT_USD),
});

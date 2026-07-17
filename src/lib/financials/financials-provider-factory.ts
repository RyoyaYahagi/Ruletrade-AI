import "server-only";

import { AppError } from "@/lib/errors/app-error";
import type { FinancialsProvider } from "@/lib/financials/financials-provider";
import { EdinetFinancialsProvider } from "@/lib/financials/providers/edinet-financials-provider";
import { MockFinancialsProvider } from "@/lib/financials/providers/mock-financials-provider";

export function createFinancialsProvider(): FinancialsProvider {
  const providerName = process.env.FINANCIALS_PROVIDER ?? "mock";
  if (providerName === "mock") return new MockFinancialsProvider();
  if (providerName === "edinet") return new EdinetFinancialsProvider();

  throw new AppError(
    "CONFIG_ERROR",
    `未知の FINANCIALS_PROVIDER: ${providerName}`,
    500,
  );
}

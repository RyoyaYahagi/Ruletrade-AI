import "server-only";

import type { FinancialStatement } from "@/schemas/financials/financial-statement-schema";

export type { FinancialStatement };

export interface FinancialsProvider {
  readonly name: "edinet" | "mock";
  fetchNewStatements(params: {
    tickers: string[];
    sinceDate: string;
  }): Promise<FinancialStatement[]>;
}

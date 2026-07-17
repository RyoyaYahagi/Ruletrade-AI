import "server-only";

import { AppError } from "@/lib/errors/app-error";
import type { FinancialsProvider } from "@/lib/financials/financials-provider";

export class EdinetFinancialsProvider implements FinancialsProvider {
  readonly name = "edinet" as const;

  async fetchNewStatements(): Promise<never> {
    throw new AppError(
      "NOT_IMPLEMENTED",
      "EDINETのXBRL主要項目パーサーは未実装です。FINANCIALS_PROVIDER=mockまたは管理者の手入力を使用してください。",
      501,
    );
  }
}

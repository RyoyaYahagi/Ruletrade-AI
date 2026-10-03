"use client";

import type { Transaction } from "@/schemas/transaction";
import { formatTransactionPrice } from "@/features/transactions/format";

export function LinkedTransactionSelector({
  transactions,
  value,
  onChange,
  loading,
  disabled,
}: {
  transactions: Transaction[];
  value: string | null;
  onChange: (transactionId: string | null) => void;
  loading: boolean;
  disabled: boolean;
}) {
  return (
    <fieldset aria-label="関連する売買" className="space-y-2">
      <legend className="text-sm text-muted-foreground">関連する売買</legend>
      {transactions.length === 1 && (
        <p className="text-xs text-muted-foreground">
          この判断と一致する売買履歴が見つかりました。
        </p>
      )}
      {transactions.length > 1 && (
        <p className="text-xs text-muted-foreground">
          候補が複数あります。関連付ける売買履歴を選択してください。
        </p>
      )}
      <label className="block text-sm" htmlFor="linked-transaction">
        <span className="sr-only">関連する売買</span>
        <select
          id="linked-transaction"
          value={value ?? "none"}
          onChange={(event) =>
            onChange(event.target.value === "none" ? null : event.target.value)
          }
          disabled={disabled || loading}
          className="input mt-1"
        >
          <option value="none">売買履歴と紐付けない</option>
          {transactions.map((transaction) => (
            <option key={transaction.id} value={transaction.id}>
              {transaction.side === "buy" ? "購入" : "売却"}・
              {new Intl.DateTimeFormat("ja-JP", {
                timeZone: "Asia/Tokyo",
              }).format(new Date(transaction.executedAt))}
              ・{transaction.quantity}株・
              {formatTransactionPrice(
                transaction.price,
                transaction.priceCurrency,
              )}
            </option>
          ))}
        </select>
        {loading && (
          <span className="mt-1 block text-xs text-muted-foreground">
            売買履歴を読み込んでいます…
          </span>
        )}
      </label>
    </fieldset>
  );
}

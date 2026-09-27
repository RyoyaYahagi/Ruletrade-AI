"use client";

import type { Transaction } from "@/schemas/transaction";

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
    <label className="block text-sm">
      関連する既存の売買履歴（任意）
      <select
        value={value ?? "none"}
        onChange={(event) =>
          onChange(event.target.value === "none" ? null : event.target.value)
        }
        disabled={disabled || loading}
        className="mt-1 w-full rounded-lg border bg-background px-3 py-2"
      >
        <option value="none">関連付けない</option>
        {transactions.map((transaction) => (
          <option key={transaction.id} value={transaction.id}>
            {transaction.side === "buy" ? "購入" : "売却"}・
            {new Intl.DateTimeFormat("ja-JP", {
              timeZone: "Asia/Tokyo",
            }).format(new Date(transaction.executedAt))}
            ・{transaction.quantity}株
          </option>
        ))}
      </select>
      {loading && (
        <span className="mt-1 block text-xs text-muted-foreground">
          売買履歴を読み込んでいます…
        </span>
      )}
    </label>
  );
}

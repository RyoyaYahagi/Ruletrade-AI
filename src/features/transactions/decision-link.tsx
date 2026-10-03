"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { linkTransactionDecisionAction } from "@/features/transactions/actions";
import { decisionDisplayText } from "@/features/decisions/decision-display";
import type { Decision } from "@/schemas/decision";

export function DecisionLink({
  id,
  decisionId,
  decisions,
}: {
  id: string;
  decisionId: string | null;
  decisions: Decision[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="w-full pb-1">
      <label className="text-sm text-muted-foreground">
        関連する判断
        <select
          value={decisionId ?? ""}
          disabled={saving}
          className="input mt-1 text-foreground"
          onChange={async (event) => {
            setSaving(true);
            setError(null);
            try {
              await linkTransactionDecisionAction({
                id,
                decisionId: event.target.value || null,
              });
              router.refresh();
            } catch (cause) {
              setError(
                cause instanceof Error
                  ? cause.message
                  : "判断を紐付けられませんでした。",
              );
            } finally {
              setSaving(false);
            }
          }}
        >
          <option value="">紐付けない</option>
          {decisions.map((decision) => (
            <option key={decision.id} value={decision.id}>
              {decision.createdAt.slice(0, 10)} ·{" "}
              {decisionDisplayText(decision).slice(0, 50)}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p role="alert" className="mt-1 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

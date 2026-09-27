"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { linkTransactionDecisionAction } from "@/features/transactions/actions";
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
    <div className="w-full">
      <label className="text-sm">
        関連する判断
        <select
          value={decisionId ?? ""}
          disabled={saving}
          className="mt-1 w-full rounded-lg border bg-background px-3 py-2"
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
              {decision.thesis ?? decision.rawInput.slice(0, 50)}
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

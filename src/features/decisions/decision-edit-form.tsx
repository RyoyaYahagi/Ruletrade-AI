"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { editDecisionAction } from "@/features/decisions/actions";
import {
  ReviewSchedule,
  resolveReviewDates,
  type ReviewScheduleValue,
} from "@/features/capture/review-schedule";
import { japanDate } from "@/features/transactions/matching";
import type { Decision } from "@/schemas/decision";
import type { Stock } from "@/schemas/stock";

function list(value: string) {
  return value
    .split("\n")
    .map((line) => line.replace(/^[-・]\s*/, "").trim())
    .filter(Boolean);
}

export function DecisionEditForm({
  stock,
  decision,
}: {
  stock: Stock;
  decision: Decision;
}) {
  const router = useRouter();
  const [type, setType] = useState(decision.type);
  const [decidedAt, setDecidedAt] = useState(
    japanDate(decision.decidedAt ?? decision.createdAt),
  );
  const [rawInput, setRawInput] = useState(decision.rawInput);
  const [thesis, setThesis] = useState(decision.thesis ?? "");
  const [assumptions, setAssumptions] = useState(
    decision.assumptions.join("\n"),
  );
  const [reviewConditions, setReviewConditions] = useState(
    decision.reviewConditions.join("\n"),
  );
  const [addConditions, setAddConditions] = useState(
    decision.addConditions.join("\n"),
  );
  const originalDates =
    decision.reviewDates ?? (decision.reviewAt ? [decision.reviewAt] : []);
  const [schedule, setSchedule] = useState<ReviewScheduleValue>({
    choices: originalDates.length ? ["date"] : [],
    earningsDate: "",
    dates: originalDates.length
      ? originalDates.map((date) => japanDate(date))
      : [""],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const backUrl = `/stocks/${stock.id}#${decision.id}`;

  async function save() {
    setError(null);
    if (!rawInput.trim() || !decidedAt) {
      setError("本文と判断した日を入力してください。");
      return;
    }
    if (schedule.choices.includes("earnings") && !schedule.earningsDate) {
      setError("次の決算日を入力してください。");
      return;
    }
    if (
      schedule.choices.includes("date") &&
      schedule.dates.some((date) => !date)
    ) {
      setError("振り返り日を入力してください。");
      return;
    }
    setSaving(true);
    try {
      const reviewDates = resolveReviewDates(schedule, originalDates);
      await editDecisionAction({
        id: decision.id,
        stockId: stock.id,
        expectedRevision: decision.editHistory?.length ?? 0,
        type,
        rawInput,
        thesis: thesis.trim() || null,
        decidedAt,
        assumptions: list(assumptions),
        reviewConditions: list(reviewConditions),
        addConditions: list(addConditions),
        reviewDates,
      });
      router.push(backUrl);
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "判断を更新できませんでした。",
      );
      setSaving(false);
    }
  }

  const fieldClass = "mt-1 w-full rounded-lg border bg-background px-3 py-2";
  return (
    <section className="surface space-y-5 p-5 sm:p-8">
      <Link href={backUrl} className="text-sm text-primary hover:underline">
        ← {stock.name}の記録
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">判断を編集</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {stock.name}の判断を修正します。編集前の内容は履歴に残ります。
        </p>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <fieldset disabled={saving} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              記録の種類
              <select
                value={type}
                onChange={(event) =>
                  setType(event.target.value as Decision["type"])
                }
                className={fieldClass}
              >
                {[
                  ["buy", "購入"],
                  ["add", "買い増し"],
                  ["sell", "売却"],
                  ["sell_consideration", "売却を検討"],
                  ["thesis_update", "仮説の更新"],
                  ["note", "メモ"],
                ].map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              判断した日
              <input
                required
                type="date"
                value={decidedAt}
                onChange={(event) => setDecidedAt(event.target.value)}
                className={fieldClass}
              />
            </label>
            <label className="text-sm sm:col-span-2">
              判断の本文
              <textarea
                required
                rows={5}
                value={rawInput}
                onChange={(event) => setRawInput(event.target.value)}
                className={fieldClass}
              />
            </label>
            <label className="text-sm sm:col-span-2">
              投資仮説
              <textarea
                rows={3}
                value={thesis}
                onChange={(event) => setThesis(event.target.value)}
                className={fieldClass}
              />
            </label>
            <label className="text-sm">
              前提（1行に1つ）
              <textarea
                rows={3}
                value={assumptions}
                onChange={(event) => setAssumptions(event.target.value)}
                className={fieldClass}
              />
            </label>
            <label className="text-sm">
              見直し条件（1行に1つ）
              <textarea
                rows={3}
                value={reviewConditions}
                onChange={(event) => setReviewConditions(event.target.value)}
                className={fieldClass}
              />
            </label>
            <label className="text-sm sm:col-span-2">
              買い増し条件（1行に1つ）
              <textarea
                rows={3}
                value={addConditions}
                onChange={(event) => setAddConditions(event.target.value)}
                className={fieldClass}
              />
            </label>
          </div>
          <ReviewSchedule value={schedule} onChange={setSchedule} />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex items-center gap-4">
            <button
              type="submit"
              className="rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground"
            >
              {saving ? "保存しています…" : "変更を保存"}
            </button>
            <Link
              href={backUrl}
              className="text-sm text-primary hover:underline"
            >
              キャンセル
            </Link>
          </div>
        </fieldset>
      </form>
    </section>
  );
}

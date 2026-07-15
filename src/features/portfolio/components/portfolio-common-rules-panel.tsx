"use client";

import { useCallback, useEffect, useState } from "react";
import { PortfolioRuleGuide } from "@/features/portfolio/components/portfolio-rule-guide";
import type { PortfolioRuleGuidanceDraft } from "@/schemas/portfolio/portfolio-rule-guidance-schema";

type TargetAllocation = {
  key: string;
  label?: string;
  targetPercent: number;
  tolerancePercent: number;
};

type CommonRuleForm = {
  maxPositionPercent: string;
  maxSectorPercent: string;
  maxThemePercent: string;
  minCashPercent: string;
  maxSingleTradeLossPercent: string;
  notes: string;
};

type Violation = {
  ruleKey: string;
  subject: string;
  limitPercent: number;
  actualPercent: number;
  severity: "medium" | "high";
  message: string;
};

const ALLOCATION_KEYS = [
  { value: "stock", label: "株式" },
  { value: "etf", label: "ETF" },
  { value: "fund", label: "投資信託" },
  { value: "reit", label: "REIT" },
  { value: "cash", label: "現金" },
  { value: "other", label: "その他" },
];

const EMPTY_FORM: CommonRuleForm = {
  maxPositionPercent: "",
  maxSectorPercent: "",
  maxThemePercent: "",
  minCashPercent: "",
  maxSingleTradeLossPercent: "",
  notes: "",
};

function toOptionalNumber(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  return Number(value);
}

export function PortfolioCommonRulesPanel() {
  const [form, setForm] = useState<CommonRuleForm>(EMPTY_FORM);
  const [allocations, setAllocations] = useState<TargetAllocation[]>([]);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [ruleConfigured, setRuleConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadCompliance = useCallback(async () => {
    const response = await fetch("/api/portfolio/compliance");
    const json = await response.json();
    if (json.ok) {
      setViolations(json.data.violations ?? []);
      setRuleConfigured(Boolean(json.data.ruleConfigured));
    }
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/portfolio/rules");
        const json = await response.json();

        if (json.ok && json.data.rule) {
          const rule = json.data.rule;
          setForm({
            maxPositionPercent: rule.maxPositionPercent?.toString() ?? "",
            maxSectorPercent: rule.maxSectorPercent?.toString() ?? "",
            maxThemePercent: rule.maxThemePercent?.toString() ?? "",
            minCashPercent: rule.minCashPercent?.toString() ?? "",
            maxSingleTradeLossPercent:
              rule.maxSingleTradeLossPercent?.toString() ?? "",
            notes: rule.notes ?? "",
          });
          setAllocations(rule.targetAllocations ?? []);
        }

        await loadCompliance();
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, [loadCompliance]);

  async function handleSave() {
    setIsSaving(true);
    setMessage(null);
    setErrorMessage(null);

    const payload = {
      maxPositionPercent: toOptionalNumber(form.maxPositionPercent),
      maxSectorPercent: toOptionalNumber(form.maxSectorPercent),
      maxThemePercent: toOptionalNumber(form.maxThemePercent),
      minCashPercent: toOptionalNumber(form.minCashPercent),
      maxSingleTradeLossPercent: toOptionalNumber(
        form.maxSingleTradeLossPercent,
      ),
      targetAllocations: allocations,
      notes: form.notes.trim() === "" ? undefined : form.notes.trim(),
    };

    try {
      const response = await fetch("/api/portfolio/rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await response.json();

      if (!response.ok || !json.ok) {
        setErrorMessage(json.error?.message ?? "共通ルールの保存に失敗しました。");
        return;
      }

      setMessage("共通ルールを保存しました。");
      await loadCompliance();
    } catch {
      setErrorMessage("通信に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  }

  function updateAllocation(
    index: number,
    patch: Partial<TargetAllocation>,
  ) {
    setAllocations((current) =>
      current.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }

  function applyGuidanceSuggestion(suggestion: PortfolioRuleGuidanceDraft) {
    setForm((current) => ({
      maxPositionPercent:
        suggestion.maxPositionPercent?.toString() ?? current.maxPositionPercent,
      maxSectorPercent:
        suggestion.maxSectorPercent?.toString() ?? current.maxSectorPercent,
      maxThemePercent:
        suggestion.maxThemePercent?.toString() ?? current.maxThemePercent,
      minCashPercent:
        suggestion.minCashPercent?.toString() ?? current.minCashPercent,
      maxSingleTradeLossPercent:
        suggestion.maxSingleTradeLossPercent?.toString() ??
        current.maxSingleTradeLossPercent,
      notes: suggestion.notes ?? current.notes,
    }));

    if (suggestion.targetAllocations !== undefined) {
      setAllocations(suggestion.targetAllocations);
    }
  }

  if (isLoading) {
    return (
      <section className="rounded-lg border p-6 text-sm text-muted-foreground">
        共通ルールを読み込み中...
      </section>
    );
  }

  const limitFields: Array<{
    key: keyof CommonRuleForm;
    label: string;
  }> = [
    { key: "maxPositionPercent", label: "1銘柄の最大比率 (%)" },
    { key: "maxSectorPercent", label: "1セクターの最大比率 (%)" },
    { key: "maxThemePercent", label: "1テーマの最大比率 (%)" },
    { key: "minCashPercent", label: "現金比率の下限 (%)" },
    {
      key: "maxSingleTradeLossPercent",
      label: "1取引あたり許容損失 (資産全体の%)",
    },
  ];

  return (
    <section
      className="rounded-lg border p-6"
      data-testid="portfolio-common-rules-panel"
    >
      <h2 className="text-lg font-semibold">ポートフォリオ共通ルール</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        全銘柄に共通する上限・下限です。ここで決めた項目は、銘柄別ルール作成時に重複して質問されません。
      </p>

      <PortfolioRuleGuide
        currentDraft={{
          maxPositionPercent: toOptionalNumber(form.maxPositionPercent),
          maxSectorPercent: toOptionalNumber(form.maxSectorPercent),
          maxThemePercent: toOptionalNumber(form.maxThemePercent),
          minCashPercent: toOptionalNumber(form.minCashPercent),
          maxSingleTradeLossPercent: toOptionalNumber(
            form.maxSingleTradeLossPercent,
          ),
          targetAllocations: allocations,
          notes: form.notes.trim() === "" ? undefined : form.notes.trim(),
        }}
        onApplySuggestion={applyGuidanceSuggestion}
      />

      {violations.length > 0 ? (
        <div
          className="mt-4 space-y-2 rounded-md bg-red-50 p-3"
          data-testid="portfolio-rule-violations"
        >
          <p className="text-sm font-medium text-red-700">
            ルール違反 {violations.length}件
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-red-700">
            {violations.map((violation) => (
              <li key={`${violation.ruleKey}-${violation.subject}`}>
                {violation.message}
              </li>
            ))}
          </ul>
        </div>
      ) : ruleConfigured ? (
        <p className="mt-4 rounded-md bg-green-50 p-3 text-sm text-green-700">
          現在、共通ルールへの違反はありません。
        </p>
      ) : null}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {limitFields.map((field) => (
          <div key={field.key}>
            <label className="block text-sm font-medium">{field.label}</label>
            <input
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={form[field.key]}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  [field.key]: event.target.value,
                }))
              }
              placeholder="未設定"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              data-testid={`common-rule-${field.key}`}
            />
          </div>
        ))}
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">目標資産配分</h3>
          <button
            type="button"
            onClick={() =>
              setAllocations((current) => [
                ...current,
                { key: "stock", targetPercent: 0, tolerancePercent: 5 },
              ])
            }
            className="rounded-md border px-3 py-1 text-sm"
            data-testid="add-target-allocation"
          >
            行を追加
          </button>
        </div>

        {allocations.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            未設定です。資産クラスごとの目標比率と許容乖離を設定できます。
          </p>
        ) : (
          <div className="mt-2 space-y-2">
            {allocations.map((allocation, index) => (
              <div key={index} className="grid grid-cols-4 items-end gap-2">
                <div>
                  <label className="block text-xs text-muted-foreground">
                    資産クラス
                  </label>
                  <select
                    value={allocation.key}
                    onChange={(event) =>
                      updateAllocation(index, { key: event.target.value })
                    }
                    className="mt-1 w-full rounded-md border px-2 py-2 text-sm"
                  >
                    {ALLOCATION_KEYS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground">
                    目標比率 (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    value={allocation.targetPercent}
                    onChange={(event) =>
                      updateAllocation(index, {
                        targetPercent: Number(event.target.value),
                      })
                    }
                    className="mt-1 w-full rounded-md border px-2 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground">
                    許容乖離 (±pt)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    value={allocation.tolerancePercent}
                    onChange={(event) =>
                      updateAllocation(index, {
                        tolerancePercent: Number(event.target.value),
                      })
                    }
                    className="mt-1 w-full rounded-md border px-2 py-2 text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setAllocations((current) =>
                      current.filter((_, i) => i !== index),
                    )
                  }
                  className="rounded-md border px-3 py-2 text-sm"
                >
                  削除
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4">
        <label className="block text-sm font-medium">メモ</label>
        <textarea
          value={form.notes}
          onChange={(event) =>
            setForm((current) => ({ ...current, notes: event.target.value }))
          }
          maxLength={4000}
          rows={2}
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      {errorMessage ? (
        <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {errorMessage}
        </p>
      ) : null}
      {message ? (
        <p className="mt-3 rounded-md bg-green-50 p-3 text-sm text-green-700">
          {message}
        </p>
      ) : null}

      <button
        type="button"
        onClick={handleSave}
        disabled={isSaving}
        className="mt-4 rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
        data-testid="save-common-rules"
      >
        {isSaving ? "保存中..." : "共通ルールを保存"}
      </button>
    </section>
  );
}

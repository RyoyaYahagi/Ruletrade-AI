"use client";

import { useEffect, useState } from "react";

type FundsPlanForm = {
  cashSavings: string;
  monthlyLivingCost: string;
  emergencyFundMonths: string;
  upcomingExpenses: string;
  plannedDebtRepayment: string;
  monthlyInvestableAmount: string;
};

type FundsPlanCalculation = {
  emergencyFund: number;
  investableAmount: number;
  isShortfall: boolean;
};

const EMPTY_FORM: FundsPlanForm = {
  cashSavings: "",
  monthlyLivingCost: "",
  emergencyFundMonths: "6",
  upcomingExpenses: "",
  plannedDebtRepayment: "",
  monthlyInvestableAmount: "",
};

function toNumber(value: string, fallback = 0): number {
  if (value.trim() === "") return fallback;
  return Number(value);
}

export function FundsPlanCard() {
  const [form, setForm] = useState<FundsPlanForm>(EMPTY_FORM);
  const [calculation, setCalculation] = useState<FundsPlanCalculation | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/me/funds-plan");
        const json = await response.json();

        if (json.ok && json.data.plan) {
          const plan = json.data.plan;
          setForm({
            cashSavings: plan.cashSavings?.toString() ?? "",
            monthlyLivingCost: plan.monthlyLivingCost?.toString() ?? "",
            emergencyFundMonths: plan.emergencyFundMonths?.toString() ?? "6",
            upcomingExpenses: plan.upcomingExpenses?.toString() ?? "",
            plannedDebtRepayment: plan.plannedDebtRepayment?.toString() ?? "",
            monthlyInvestableAmount:
              plan.monthlyInvestableAmount?.toString() ?? "",
          });
          setCalculation(json.data.calculation ?? null);
        }
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, []);

  async function handleSave() {
    setIsSaving(true);
    setErrorMessage(null);

    const payload = {
      cashSavings: toNumber(form.cashSavings),
      monthlyLivingCost: toNumber(form.monthlyLivingCost),
      emergencyFundMonths: Math.round(toNumber(form.emergencyFundMonths, 6)),
      upcomingExpenses: toNumber(form.upcomingExpenses),
      plannedDebtRepayment: toNumber(form.plannedDebtRepayment),
      monthlyInvestableAmount:
        form.monthlyInvestableAmount.trim() === ""
          ? undefined
          : Number(form.monthlyInvestableAmount),
    };

    try {
      const response = await fetch("/api/me/funds-plan", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await response.json();

      if (!response.ok || !json.ok) {
        setErrorMessage(json.error?.message ?? "資金計画の保存に失敗しました。");
        return;
      }

      setCalculation(json.data.calculation ?? null);
    } catch {
      setErrorMessage("通信に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <section className="rounded-lg border p-6 text-sm text-muted-foreground">
        資金計画を読み込み中...
      </section>
    );
  }

  const fields: Array<{ key: keyof FundsPlanForm; label: string }> = [
    { key: "cashSavings", label: "預貯金" },
    { key: "monthlyLivingCost", label: "毎月の生活費" },
    { key: "emergencyFundMonths", label: "生活防衛資金（月数）" },
    { key: "upcomingExpenses", label: "近い将来の支出（1〜3年）" },
    { key: "plannedDebtRepayment", label: "返済予定額" },
    { key: "monthlyInvestableAmount", label: "毎月の投資可能額（任意）" },
  ];

  return (
    <section className="rounded-lg border p-6" data-testid="funds-plan-card">
      <h2 className="text-lg font-semibold">投資に回せる資金</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        預貯金から生活防衛資金・近い将来の支出・返済予定を差し引いた金額を、当面使わない資金の目安として計算します。
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {fields.map((field) => (
          <div key={field.key}>
            <label className="block text-sm font-medium">{field.label}</label>
            <input
              type="number"
              min={0}
              value={form[field.key]}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  [field.key]: event.target.value,
                }))
              }
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              data-testid={`funds-plan-${field.key}`}
            />
          </div>
        ))}
      </div>

      {calculation ? (
        <div
          className={`mt-4 rounded-md p-3 text-sm ${
            calculation.isShortfall
              ? "bg-red-50 text-red-700"
              : "bg-green-50 text-green-700"
          }`}
          data-testid="funds-plan-result"
        >
          <p>
            生活防衛資金の目安:{" "}
            {calculation.emergencyFund.toLocaleString()}
          </p>
          <p className="mt-1 font-medium">
            投資に回せる資金の目安:{" "}
            {calculation.investableAmount.toLocaleString()}
          </p>
          {calculation.isShortfall ? (
            <p className="mt-1">
              生活防衛資金や支出予定を差し引くとマイナスになります。まずは現金の確保を優先する状態です。
            </p>
          ) : null}
        </div>
      ) : null}

      {errorMessage ? (
        <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {errorMessage}
        </p>
      ) : null}

      <button
        type="button"
        onClick={handleSave}
        disabled={isSaving}
        className="mt-4 rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
        data-testid="save-funds-plan"
      >
        {isSaving ? "計算中..." : "保存して計算"}
      </button>
    </section>
  );
}

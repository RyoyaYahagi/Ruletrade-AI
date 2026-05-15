export function RuleDraftView({ ruleJson }: { ruleJson: unknown }) {
  const json = ruleJson as Record<string, unknown> | null | undefined;

  return (
    <section className="rounded-lg border p-6">
      <h2 className="text-lg font-semibold">ルール草案</h2>

      <div className="mt-4 space-y-4 text-sm">
        <RuleField label="投資理由" value={json?.investmentThesis} />

        <RuleField label="投資期間" value={json?.timeHorizon} />

        <RuleField
          label="買いたい価格帯"
          value={
            (json?.entryPlan as Record<string, unknown> | undefined)
              ? `${(json?.entryPlan as Record<string, unknown>)?.targetPriceMin ?? "未設定"} 〜 ${
                  (json?.entryPlan as Record<string, unknown>)
                    ?.targetPriceMax ?? "未設定"
                } ${(json?.entryPlan as Record<string, unknown>)?.currency ?? ""}`
              : undefined
          }
        />

        <RuleField
          label="分割回数"
          value={
            (json?.entryPlan as Record<string, unknown> | undefined)?.tranches
          }
        />

        <RuleField
          label="最大投資比率"
          value={
            (json?.riskManagement as Record<string, unknown> | undefined)
              ?.maxPositionPercent
              ? `${(json?.riskManagement as Record<string, unknown>)?.maxPositionPercent}%`
              : undefined
          }
        />

        <RuleField
          label="損切り・見直し条件"
          value={
            (json?.riskManagement as Record<string, unknown> | undefined)
              ?.stopLossRule
          }
        />

        <RuleField
          label="利確・出口条件"
          value={
            (json?.exitPlan as Record<string, unknown> | undefined)
              ?.takeProfitRule
          }
        />
      </div>
    </section>
  );
}

function RuleField({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-pre-wrap">
        {value == null ? "未設定" : String(value)}
      </p>
    </div>
  );
}

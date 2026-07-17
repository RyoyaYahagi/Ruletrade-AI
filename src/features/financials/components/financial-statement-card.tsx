type FinancialStatementRow = {
  fiscal_period?: string | null;
  revenue?: number | null;
  operating_income?: number | null;
  net_income?: number | null;
  eps?: number | null;
  dividend_per_share?: number | null;
  equity_ratio?: number | null;
  currency?: string | null;
  filed_at?: string | null;
  source?: string | null;
};

export function FinancialStatementCard({
  statement,
}: {
  statement: FinancialStatementRow | null;
}) {
  return (
    <section className="rounded-lg border p-6" aria-label="最新の決算数値">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold">最新の決算数値</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            開示された数値のみを表示します。評価や見通しは含みません。
          </p>
        </div>
        {statement ? (
          <span className="rounded-full bg-gray-100 px-2 py-1 text-xs">
            {statement.fiscal_period ?? "未取得"}
          </span>
        ) : null}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <FinancialValue label="売上" value={statement?.revenue} suffix={statement?.currency} />
        <FinancialValue label="営業利益" value={statement?.operating_income} suffix={statement?.currency} />
        <FinancialValue label="純利益" value={statement?.net_income} suffix={statement?.currency} />
        <FinancialValue label="EPS" value={statement?.eps} suffix={statement?.currency} />
        <FinancialValue label="1株配当" value={statement?.dividend_per_share} suffix={statement?.currency} />
        <FinancialValue label="自己資本比率" value={statement?.equity_ratio} suffix="%" />
      </dl>

      <div className="mt-4 space-y-1 text-xs text-muted-foreground">
        <p>開示日: {statement?.filed_at ?? "未取得"}</p>
        <p>出典: {formatSource(statement?.source)}</p>
      </div>
    </section>
  );
}

function FinancialValue({
  label,
  value,
  suffix,
}: {
  label: string;
  value?: number | null;
  suffix?: string | null;
}) {
  return (
    <div className="rounded-md bg-gray-50 p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">
        {formatFinancialValue(value)}{value == null || !suffix ? "" : ` ${suffix}`}
      </dd>
    </div>
  );
}

export function formatFinancialValue(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "未取得";
  return value.toLocaleString("ja-JP", { maximumFractionDigits: 2 });
}

function formatSource(source: string | null | undefined) {
  if (source === "edinet") return "EDINET";
  if (source === "manual") return "管理者入力";
  if (source === "mock") return "Mock";
  return source ?? "未取得";
}

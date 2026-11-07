import { evaluateBucketWarning } from "@/features/portfolio/bucket-warning";
import type { BucketSummary } from "@/features/portfolio/bucket-summary";
import { formatPortfolioAmount } from "@/features/portfolio/format";
import type { AppSettings } from "@/schemas/app-settings";
import type { Bucket } from "@/schemas/stock";

const BUCKET_ORDER: readonly Bucket[] = ["core", "satellite", "unclassified"];

const BUCKET_COLORS: Record<Bucket, string> = {
  core: "var(--chart-1)",
  satellite: "var(--chart-2)",
  unclassified: "var(--chart-6)",
};

const BUCKET_LABELS: Record<Bucket, string> = {
  core: "コア",
  satellite: "サテライト",
  unclassified: "未分類",
};

function formatPercent(value: number): string {
  return `${value.toLocaleString("ja-JP", { maximumFractionDigits: 1 })}%`;
}

function formatYen(value: number): string {
  return formatPortfolioAmount(value, "JPY");
}

function formatRateAt(value: string | null): string {
  if (value === null) return "時点不明";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "時点不明";
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(date);
}

function Bar({ summary }: { summary: BucketSummary }) {
  const total = summary.totalInvestedJpy;
  if (total === null || total <= 0) return null;
  const segments = BUCKET_ORDER.map((bucket) => ({
    bucket,
    value: summary.buckets[bucket].investedJpy,
  })).filter(
    (segment): segment is { bucket: Bucket; value: number } =>
      segment.value !== null && segment.value > 0,
  );

  return (
    <div className="space-y-2">
      <div
        className="flex h-3 overflow-hidden rounded-full bg-secondary"
        role="img"
        aria-label={`投入額ベースの内訳: ${segments
          .map(
            ({ bucket, value }) =>
              `${BUCKET_LABELS[bucket]} ${formatPercent((value / total) * 100)}`,
          )
          .join("、")}`}
      >
        {segments.map(({ bucket, value }) => (
          <span
            key={bucket}
            style={{
              width: `${(value / total) * 100}%`,
              backgroundColor: BUCKET_COLORS[bucket],
            }}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {segments.map(({ bucket, value }) => (
          <li key={bucket} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-[3px]"
              style={{ backgroundColor: BUCKET_COLORS[bucket] }}
            />
            {BUCKET_LABELS[bucket]}{" "}
            <span className="font-mono text-foreground">
              {formatYen(value)}
            </span>
            <span className="font-mono">
              ({formatPercent((value / total) * 100)})
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BucketAllocationPanel({
  summary,
  settings,
}: {
  summary: BucketSummary;
  settings: AppSettings;
}) {
  const warning = evaluateBucketWarning(summary, settings.satelliteWarnPct);
  const totalInvested = summary.totalInvestedJpy;
  const satelliteInvested = summary.satelliteInvestedJpy;
  const satellitePct = summary.satelliteInvestedPct;
  const capPct = settings.satelliteCapPct;
  const capAmount =
    capPct !== null && totalInvested !== null
      ? (totalInvested * capPct) / 100
      : null;
  const remaining =
    capAmount !== null && satelliteInvested !== null
      ? capAmount - satelliteInvested
      : null;
  const canShowInvested =
    summary.investedComplete &&
    !summary.rateUnavailable &&
    totalInvested !== null &&
    satellitePct !== null;

  return (
    <section
      className="surface space-y-4 p-5"
      aria-labelledby="bucket-allocation-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="bucket-allocation-heading" className="font-semibold">
          コア／サテライト
        </h2>
        <span className="chip">参考値</span>
      </div>

      {canShowInvested ? (
        <>
          <div>
            <p className="text-xs text-muted-foreground">
              サテライト割合（投入額ベース）
            </p>
            <p className="mt-0.5 font-mono text-4xl tracking-tight">
              {formatPercent(satellitePct)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {capPct === null ? (
                "上限未設定"
              ) : remaining !== null && remaining >= 0 ? (
                <>
                  上限 {formatPercent(capPct)}（{formatYen(capAmount!)}
                  ）まであと{" "}
                  <span className="font-mono font-semibold text-foreground">
                    {formatYen(remaining)}
                  </span>
                </>
              ) : remaining !== null ? (
                <span className="text-attention">
                  上限 {formatPercent(capPct)}（{formatYen(capAmount!)}）を{" "}
                  {formatYen(-remaining)} 超過しています
                </span>
              ) : null}
            </p>
          </div>
          <Bar summary={summary} />
          <div className="border-t pt-3">
            <p className="text-xs text-muted-foreground">
              サテライト割合（時価ベース）
            </p>
            {summary.satelliteMarketValuePct === null ? (
              <p className="mt-1 text-sm">時価ベースは算出できません。</p>
            ) : (
              <p
                className={`mt-0.5 font-mono text-lg ${warning ? "font-semibold text-attention" : ""}`}
              >
                {formatPercent(summary.satelliteMarketValuePct)}
              </p>
            )}
            {warning ? (
              <p role="status" className="mt-1 text-sm text-attention">
                警告線 {formatPercent(warning.warnPct)}{" "}
                を超えています。枠の状態を確認してください。
              </p>
            ) : settings.satelliteWarnPct === null ? (
              <p className="mt-1 text-xs text-muted-foreground">警告線未設定</p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                警告線 {formatPercent(settings.satelliteWarnPct)} 以下です。
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              時価ベースは警告線の確認用で、上限判定には使いません。
            </p>
          </div>
        </>
      ) : (
        <div className="space-y-1 text-sm text-muted-foreground">
          {!summary.investedComplete ? (
            <p>
              一部の買付金額が不明なため、投入額ベースの割合を表示できません。
            </p>
          ) : summary.rateUnavailable ? (
            <p>換算レートを取得できないため、円換算の割合を表示できません。</p>
          ) : totalInvested === 0 ? (
            <p>まだ投入額がありません。</p>
          ) : (
            <p>投入額ベースの割合を算出できません。</p>
          )}
          {settings.satelliteCapPct === null && <p>上限未設定</p>}
        </div>
      )}

      <ul className="space-y-1 text-xs leading-5 text-muted-foreground">
        {summary.exchangeRate !== null ? (
          <li>
            割合は円換算の参考値です。換算レート 1 USD ={" "}
            {summary.exchangeRate.rate.toLocaleString("ja-JP", {
              maximumFractionDigits: 2,
            })}
            円（{formatRateAt(summary.exchangeRate.priceAt)}時点
            {summary.exchangeRate.sourceName
              ? ` / ${summary.exchangeRate.sourceName}`
              : ""}
            ）
          </li>
        ) : summary.rateRequired ? (
          <li>換算レートを取得できませんでした。古いレートは使いません。</li>
        ) : (
          <li>USD建て資産がないため、換算は不要です。</li>
        )}
        {!summary.coreRegistered && (
          <li>コア未登録のため、割合はサテライトのみで計算されています。</li>
        )}
        {summary.includesUnclassified && (
          <li>未分類の銘柄はサテライト側に含めています。</li>
        )}
        {summary.substitutedStockNames.length > 0 && (
          <li>
            価格を取得できないため評価額を取得金額で代用しています:{" "}
            {summary.substitutedStockNames.join("、")}
          </li>
        )}
        {!summary.marketValueComplete && (
          <li>
            一部の評価額が不明なため、時価ベースの割合は完全な値ではありません。
          </li>
        )}
      </ul>
    </section>
  );
}

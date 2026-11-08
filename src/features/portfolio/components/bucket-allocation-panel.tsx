import Link from "next/link";

import { evaluateBucketWarning } from "@/features/portfolio/bucket-warning";
import {
  satelliteRemainingJpy,
  type BucketSummary,
} from "@/features/portfolio/bucket-summary";
import { formatPortfolioAmount } from "@/features/portfolio/format";
import type { AppSettings } from "@/schemas/app-settings";
import type { Bucket } from "@/schemas/stock";

// サテライト側を左から伸ばすと、上限の目印線を「左から上限％」の位置に置ける。
// 並びは表示だけの都合で、集計値は bucket-summary の値をそのまま使う。
const BAR_ORDER: readonly Bucket[] = ["satellite", "unclassified", "core"];

const BUCKET_COLORS: Record<Bucket, string> = {
  satellite: "var(--chart-1)",
  unclassified: "var(--chart-3)",
  core: "var(--chart-6)",
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
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(date);
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-1 rounded-xl bg-secondary/60 px-3 py-2.5 text-sm leading-6">
      {children}
    </div>
  );
}

function EmptyBar() {
  return (
    <div
      aria-hidden="true"
      className="h-3 rounded-full border border-dashed border-muted-foreground/40"
    />
  );
}

function Bar({
  summary,
  capPct,
}: {
  summary: BucketSummary;
  capPct: number | null;
}) {
  const total = summary.totalMarketValueJpy;
  if (total === null || total <= 0) return <EmptyBar />;
  const segments = BAR_ORDER.map((bucket) => ({
    bucket,
    value: summary.buckets[bucket].marketValueJpy ?? 0,
  }));

  return (
    <div className="space-y-2">
      <div className="relative pt-5">
        {capPct !== null && (
          <div
            aria-hidden="true"
            className="absolute inset-y-0 z-10 flex -translate-x-1/2 flex-col items-center"
            style={{ left: `${Math.min(capPct, 100)}%` }}
          >
            <span className="font-mono text-[11px] leading-4 whitespace-nowrap text-foreground">
              上限{formatPercent(capPct)}
            </span>
            <span className="w-0.5 flex-1 bg-foreground" />
          </div>
        )}
        <div
          className="flex h-3 overflow-hidden rounded-full bg-secondary"
          role="img"
          aria-label={`評価額ベースの内訳: ${segments
            .map(
              ({ bucket, value }) =>
                `${BUCKET_LABELS[bucket]} ${formatPercent((value / total) * 100)}`,
            )
            .join(
              "、",
            )}${capPct === null ? "" : `。上限 ${formatPercent(capPct)}`}`}
        >
          {segments.map(({ bucket, value }) =>
            value > 0 ? (
              <span
                key={bucket}
                style={{
                  width: `${(value / total) * 100}%`,
                  backgroundColor: BUCKET_COLORS[bucket],
                }}
              />
            ) : null,
          )}
        </div>
      </div>
      <ul className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
        {segments.map(({ bucket, value }) => (
          <li key={bucket}>
            <span className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="size-2.5 rounded-[3px]"
                style={{ backgroundColor: BUCKET_COLORS[bucket] }}
              />
              {BUCKET_LABELS[bucket]}
            </span>
            <span className="mt-0.5 block font-mono text-foreground">
              {formatYen(value)}
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
  const totalMarketValue = summary.totalMarketValueJpy;
  const satellitePct = summary.satelliteMarketValuePct;
  const capPct = settings.satelliteCapPct;
  const canShowRatio =
    summary.marketValueComplete &&
    !summary.rateUnavailable &&
    totalMarketValue !== null &&
    satellitePct !== null;
  // コアが未登録なら上限が設定されていても残り枠は出さない（設計案 判断 2-3 の A）
  const capApplies = capPct !== null && summary.coreRegistered;
  const cap = canShowRatio ? satelliteRemainingJpy(summary, capPct) : null;
  const capAmount = cap?.capAmountJpy ?? null;
  const remaining = cap?.remainingJpy ?? null;
  const substituted = summary.substitutedStockNames.length > 0;

  return (
    <section
      className="surface space-y-4 p-5"
      aria-labelledby="bucket-allocation-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="bucket-allocation-heading" className="font-semibold">
          コア／サテライト
        </h2>
        <span className="chip">参考値・評価額ベース</span>
      </div>

      <div>
        {remaining !== null && remaining >= 0 ? (
          <>
            <p className="text-xs text-muted-foreground">
              サテライトに足せる残り
            </p>
            <p className="mt-0.5 font-mono text-4xl tracking-tight">
              {formatYen(remaining)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              上限 {formatPercent(capPct!)}（{formatYen(capAmount!)}）まで ·
              現在 {formatPercent(satellitePct!)}
              {substituted ? "＊" : ""}
            </p>
          </>
        ) : remaining !== null ? (
          <>
            <p className="text-xs text-attention">上限を超えている額</p>
            <p className="mt-0.5 font-mono text-4xl tracking-tight text-attention">
              {formatYen(-remaining)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              上限 {formatPercent(capPct!)}（{formatYen(capAmount!)}
              ）に対して現在 {formatPercent(satellitePct!)}
              {substituted ? "＊" : ""}
            </p>
          </>
        ) : canShowRatio ? (
          <>
            <p className="text-xs text-muted-foreground">サテライト割合</p>
            <p className="mt-0.5 font-mono text-4xl tracking-tight">
              {formatPercent(satellitePct)}
              {substituted ? "＊" : ""}
            </p>
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {capApplies ? "サテライトに足せる残り" : "サテライト割合"}
            </p>
            <p className="mt-0.5 font-mono text-4xl tracking-tight text-muted-foreground">
              —
            </p>
          </>
        )}
      </div>

      {summary.rateUnavailable ? (
        <Notice>
          <p>
            USD建ての銘柄があり、換算レートを取得できなかったため、円換算の割合と残り枠を出していません。古いレートは使いません。
          </p>
        </Notice>
      ) : !summary.marketValueComplete ? (
        <Notice>
          <p>一部の銘柄の評価額が不明なため、割合と残り枠を出していません。</p>
        </Notice>
      ) : totalMarketValue === 0 ? (
        <Notice>
          <p>まだ保有がありません。</p>
        </Notice>
      ) : !canShowRatio ? (
        <Notice>
          <p>評価額ベースの割合を算出できません。</p>
        </Notice>
      ) : !summary.coreRegistered ? (
        <Notice>
          <p>
            コアに区分した銘柄がまだありません。割合はサテライトと未分類だけで計算しているため、残り枠は出していません。
          </p>
          <Link
            href="/portfolio#holdings"
            className="inline-block font-semibold text-primary underline-offset-4 hover:underline"
          >
            銘柄の区分を見る
          </Link>
        </Notice>
      ) : capPct === null ? (
        <p className="text-sm text-muted-foreground">
          上限が未設定のため、残り枠は出していません。{" "}
          <Link
            href="/more#bucket-settings"
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            枠の設定へ
          </Link>
        </p>
      ) : null}

      {canShowRatio ? (
        <div className="space-y-1">
          <Bar summary={summary} capPct={capApplies ? capPct : null} />
          {summary.includesUnclassified && (
            <p className="text-xs text-muted-foreground">
              未分類はサテライト側に数えています
            </p>
          )}
        </div>
      ) : (
        <EmptyBar />
      )}

      <div className="space-y-2 border-t pt-3">
        {warning ? (
          <div
            role="status"
            className="space-y-1 rounded-xl bg-attention-soft px-3 py-2.5"
          >
            <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm font-semibold text-attention">
              警告線を超えています
              <span className="font-mono">
                {formatPercent(warning.marketValuePct)}
                {substituted ? "＊" : ""} / {formatPercent(warning.warnPct)}
              </span>
            </p>
          </div>
        ) : (
          <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
            <span className="text-muted-foreground">警告線</span>
            {satellitePct === null || summary.rateUnavailable ? (
              <span className="text-muted-foreground">判定できません</span>
            ) : (
              <span className="font-mono">
                {settings.satelliteWarnPct === null
                  ? "未設定"
                  : `${formatPercent(settings.satelliteWarnPct)} 以下`}
              </span>
            )}
          </p>
        )}
        {substituted && (
          <p className="text-xs text-muted-foreground">
            ＊{summary.substitutedStockNames.length}銘柄（
            {summary.substitutedStockNames.join("、")}
            ）は価格を取得できないため、評価額を取得金額で代用しています。
          </p>
        )}
        {summary.exchangeRate !== null && (
          <p className="text-xs text-muted-foreground">
            1 USD ={" "}
            {summary.exchangeRate.rate.toLocaleString("ja-JP", {
              maximumFractionDigits: 2,
            })}
            円 · {formatRateAt(summary.exchangeRate.priceAt)} 時点
            {summary.exchangeRate.sourceName
              ? ` · ${summary.exchangeRate.sourceName}`
              : ""}
          </p>
        )}
      </div>

      <details className="rounded-xl bg-secondary/60 px-3 py-2 text-xs leading-5 text-muted-foreground">
        <summary className="cursor-pointer font-semibold">計算の前提</summary>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>割合と金額は記録から計算した参考値です。</li>
          <li>
            割合・上限・警告線は、どれも評価額（時価）の合計に対するサテライトの割合です。値上がりでも割合は増えます。
          </li>
          <li>価格を取得できない銘柄は、評価額を取得金額で代用します。</li>
          <li>
            USD建ては円に換算します。換算レートが取れないとき、古いレートでは代用しません。
          </li>
        </ul>
      </details>
    </section>
  );
}

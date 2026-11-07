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
  const total = summary.totalInvestedJpy;
  if (total === null || total <= 0) return <EmptyBar />;
  const segments = BAR_ORDER.map((bucket) => ({
    bucket,
    value: summary.buckets[bucket].investedJpy ?? 0,
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
          aria-label={`投入額ベースの内訳: ${segments
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
  const totalInvested = summary.totalInvestedJpy;
  const satellitePct = summary.satelliteInvestedPct;
  const capPct = settings.satelliteCapPct;
  const canShowInvested =
    summary.investedComplete &&
    !summary.rateUnavailable &&
    totalInvested !== null &&
    satellitePct !== null;
  // コアが未登録なら上限が設定されていても残り枠は出さない（設計案 判断 2-3 の A）
  const capApplies = capPct !== null && summary.coreRegistered;
  const cap = canShowInvested ? satelliteRemainingJpy(summary, capPct) : null;
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
        <span className="chip">参考値・投入額ベース</span>
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
            </p>
          </>
        ) : canShowInvested ? (
          <>
            <p className="text-xs text-muted-foreground">サテライト割合</p>
            <p className="mt-0.5 font-mono text-4xl tracking-tight">
              {formatPercent(satellitePct)}
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

      {!summary.investedComplete ? (
        <Notice>
          <p>
            一部の買付金額が不明なため、投入額ベースの割合を表示できません。
          </p>
        </Notice>
      ) : summary.rateUnavailable ? (
        <Notice>
          <p>
            USD建ての銘柄があり、換算レートを取得できなかったため、円換算の割合と残り枠を出していません。古いレートは使いません。
          </p>
        </Notice>
      ) : totalInvested === 0 ? (
        <Notice>
          <p>まだ投入額がありません。</p>
        </Notice>
      ) : !canShowInvested ? (
        <Notice>
          <p>投入額ベースの割合を算出できません。</p>
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

      {canShowInvested ? (
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
            <p className="text-xs text-attention">
              時価ベースのサテライト割合です。上限の判定には使いません。
            </p>
          </div>
        ) : (
          <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
            <span className="text-muted-foreground">時価ベース</span>
            {summary.satelliteMarketValuePct === null ||
            summary.rateUnavailable ? (
              <span className="text-muted-foreground">算出できません</span>
            ) : (
              <span className="font-mono">
                {formatPercent(summary.satelliteMarketValuePct)}
                {substituted ? "＊" : ""}
                <span className="text-muted-foreground">
                  {" "}
                  /{" "}
                  {settings.satelliteWarnPct === null
                    ? "警告線 未設定"
                    : `警告線 ${formatPercent(settings.satelliteWarnPct)}`}
                </span>
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
        {!summary.marketValueComplete && (
          <p className="text-xs text-muted-foreground">
            一部の評価額が不明なため、時価ベースの割合を出していません。
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
          <li>上限は投入額（買付金額の合計）に対する割合で判定します。</li>
          <li>時価ベースの割合は警告線の確認だけに使います。</li>
          <li>
            USD建ては円に換算します。換算レートが取れないとき、古いレートでは代用しません。
          </li>
        </ul>
      </details>
    </section>
  );
}

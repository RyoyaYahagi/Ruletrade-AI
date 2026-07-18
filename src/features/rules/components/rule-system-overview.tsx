import Link from "next/link";

import { AttentionBadge } from "@/components/status/attention-badge";
import { StatValue } from "@/components/status/stat-value";
import { buttonVariants } from "@/components/ui/button";
import type {
  RuleCategoryKey,
  RuleSystemOverview,
  RuleSystemSession,
} from "@/features/rules/services/rule-system-overview-service";

const categoryLabels: Record<RuleCategoryKey, string> = {
  entry: "エントリー",
  exit: "手仕舞い",
  risk: "損切り・リスク",
  thesis: "投資仮説",
};

const riskToleranceLabels = {
  conservative: "慎重",
  moderate: "中立",
  aggressive: "積極",
} as const;

const sessionStatusLabels: Record<string, string> = {
  draft: "下書き",
  in_progress: "作成中",
  needs_more_info: "追加情報待ち",
  quality_gate_passed: "レビュー通過",
  paused: "一時停止",
  finalized: "確定済み",
};

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

export function RuleSystemOverview({
  overview,
}: {
  overview: RuleSystemOverview;
}) {
  return (
    <main
      className="mx-auto min-h-screen w-full max-w-5xl px-5 py-8 sm:px-8"
      data-testid="rules-page"
    >
      <nav
        className="flex flex-wrap gap-3 text-sm text-muted-foreground"
        aria-label="メインナビゲーション"
      >
        <Link href="/today" className="underline-offset-4 hover:underline">
          Today
        </Link>
        <Link href="/rules" className="font-medium text-foreground">
          ルール体系
        </Link>
        <Link href="/portfolio" className="underline-offset-4 hover:underline">
          ポートフォリオ
        </Link>
        <Link
          href="/notifications"
          className="underline-offset-4 hover:underline"
        >
          通知
        </Link>
      </nav>

      <header className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Rule system
          </p>
          <h1
            className="mt-2 text-3xl font-semibold"
            data-testid="rules-heading"
          >
            ルール体系
          </h1>
          <p className="mt-3 text-base leading-[1.7] text-muted-foreground">
            自分の判断基準の定義状況と、見直しが必要な項目を確認できます。売買の推奨ではありません。
          </p>
        </div>
        <Link
          href="/rules/new"
          className={buttonVariants()}
          data-testid="rules-new-rule-button"
        >
          新しいルールを作る
        </Link>
      </header>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-background p-4">
          <StatValue
            label="銘柄ルール"
            value={`${overview.stats.sessionsTotal}件`}
          />
        </div>
        <div className="rounded-xl border bg-background p-4">
          <StatValue
            label="承認済み"
            value={`${overview.stats.approvedCount}件`}
          />
        </div>
        <div className="rounded-xl border bg-background p-4">
          <StatValue
            label="未言語化の項目"
            value={`${overview.stats.gapsTotal}件`}
          />
        </div>
        <div className="rounded-xl border bg-background p-4">
          <StatValue
            label="見直し期限切れ"
            value={`${overview.stats.reviewDueCount}件`}
          />
        </div>
      </div>

      <PolicyStrip policy={overview.policy} />

      <section className="mt-8" data-testid="rules-coverage-matrix">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">ルールのカバレッジ</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              ルールJSONに定義されている項目を、銘柄ごとに確認できます。
            </p>
          </div>
          <span className="text-sm text-muted-foreground">
            未定義の項目を言語化しましょう
          </span>
        </div>

        {overview.sessions.length === 0 ? (
          <div
            className="mt-4 rounded-xl border border-dashed p-8 text-center"
            data-testid="rules-coverage-empty-state"
          >
            <h3 className="text-lg font-semibold">
              まだ銘柄ルールがありません
            </h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              新しいルールを作ると、エントリー・手仕舞い・リスク・投資仮説の定義状況をここで確認できます。
            </p>
            <Link
              href="/rules/new"
              className={`${buttonVariants({ variant: "outline" })} mt-5`}
            >
              新しいルールを作る
            </Link>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border">
            <div className="min-w-[760px]">
              <div className="grid grid-cols-[minmax(190px,1.4fr)_repeat(4,minmax(110px,1fr))_minmax(130px,0.9fr)] gap-3 border-b bg-muted/30 px-4 py-3 text-sm font-medium text-muted-foreground">
                <span>銘柄</span>
                {(Object.keys(categoryLabels) as RuleCategoryKey[]).map(
                  (category) => (
                    <span key={category}>{categoryLabels[category]}</span>
                  ),
                )}
                <span>状態</span>
              </div>
              <div className="divide-y">
                {overview.sessions.map((session) => (
                  <SessionRow key={session.id} session={session} />
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {overview.unlinkedPositions.length > 0 ? (
        <section
          className="mt-8 rounded-xl border border-amber-200 bg-amber-50/70 p-5"
          data-testid="rules-unlinked-positions"
        >
          <h2 className="text-lg font-semibold text-amber-950">
            ルール未紐付けの保有ポジション
          </h2>
          <p className="mt-2 text-sm leading-6 text-amber-950/80">
            次の保有ポジションには銘柄別ルールが紐付いていません。ポートフォリオから確認できます。
          </p>
          <ul className="mt-4 divide-y divide-amber-200 rounded-lg border border-amber-200 bg-background">
            {overview.unlinkedPositions.map((position) => (
              <li key={position.id} className="px-4 py-3 text-sm">
                {position.companyName
                  ? `${position.companyName} (${position.ticker})`
                  : position.ticker}
              </li>
            ))}
          </ul>
          <Link
            href="/portfolio"
            className="mt-4 inline-block text-sm font-medium text-amber-950 underline-offset-4 hover:underline"
          >
            ポートフォリオを確認する →
          </Link>
        </section>
      ) : null}

      <div className="mt-8 flex flex-wrap gap-3 border-t pt-6">
        <Link
          href="/rules/new"
          className={buttonVariants()}
          data-testid="rules-new-rule-button-footer"
        >
          新しいルールを作る
        </Link>
        <Link
          href="/portfolio"
          className={buttonVariants({ variant: "outline" })}
          data-testid="rules-portfolio-link"
        >
          ポートフォリオを見る
        </Link>
      </div>
    </main>
  );
}

function PolicyStrip({ policy }: Pick<RuleSystemOverview, "policy">) {
  return (
    <section
      className="mt-8 rounded-xl border bg-muted/20 p-5"
      data-testid="rules-policy-strip"
    >
      <h2 className="text-lg font-semibold">投資方針</h2>
      {!policy ? (
        <p className="mt-3 text-sm text-muted-foreground">
          投資方針がまだ登録されていません
        </p>
      ) : (
        <div className="mt-4 grid gap-5 md:grid-cols-[180px_1fr_1.4fr]">
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              リスク許容度
            </p>
            <p className="mt-1 font-medium">
              {policy.riskTolerance
                ? riskToleranceLabels[policy.riskTolerance]
                : "未設定"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              優先市場
            </p>
            {policy.preferredMarkets.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {policy.preferredMarkets.map((market) => (
                  <span
                    key={market}
                    className="rounded-full border bg-background px-2.5 py-1 text-xs"
                  >
                    {market}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">未設定</p>
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              継続的な制約
            </p>
            {policy.standingConstraints.length > 0 ? (
              <ul className="mt-2 space-y-1 text-sm">
                {policy.standingConstraints.map((constraint) => (
                  <li key={constraint}>・{constraint}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">未設定</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function SessionRow({ session }: { session: RuleSystemSession }) {
  return (
    <Link
      href={`/rules/${session.id}`}
      className="grid grid-cols-[minmax(190px,1.4fr)_repeat(4,minmax(110px,1fr))_minmax(130px,0.9fr)] gap-3 px-4 py-4 transition hover:bg-muted/40"
      data-testid={`rules-session-row-${session.id}`}
    >
      <div className="min-w-0">
        <p className="truncate font-medium">
          {session.companyName
            ? `${session.companyName} (${session.ticker})`
            : session.ticker}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          更新 {formatDate(session.updatedAt)}
        </p>
        {session.reviewDue ? (
          <p className="mt-1 text-xs font-medium text-amber-800">
            90日以上未レビュー
          </p>
        ) : null}
      </div>
      {(Object.keys(categoryLabels) as RuleCategoryKey[]).map((category) => (
        <div key={category} className="flex items-start">
          <CoverageCell
            defined={session.coverage[category]}
            unavailable={session.ruleParseFailed}
          />
        </div>
      ))}
      <div className="flex flex-col items-start gap-2">
        <AttentionBadge status={session.attentionStatus} />
        <span className="text-xs text-muted-foreground">
          {sessionStatusLabels[session.status] ?? session.status}
        </span>
        {session.ruleParseFailed ? (
          <span className="text-xs text-amber-800">
            ルール内容を読み込めませんでした
          </span>
        ) : session.gaps.length > 0 ? (
          <span className="text-xs leading-5 text-muted-foreground">
            {session.gaps
              .map(
                (category) =>
                  `${categoryLabels[category]}が言語化されていません`,
              )
              .join("、")}
          </span>
        ) : null}
      </div>
    </Link>
  );
}

function CoverageCell({
  defined,
  unavailable,
}: {
  defined: boolean;
  unavailable: boolean;
}) {
  return (
    <span
      className={
        unavailable
          ? "rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700"
          : defined
            ? "rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800"
            : "rounded-md border border-dashed border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900"
      }
    >
      {unavailable ? "読み込み不可" : defined ? "定義済み" : "未言語化"}
    </span>
  );
}

function formatDate(value: string) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp)
    ? dateFormatter.format(new Date(timestamp))
    : "未設定";
}

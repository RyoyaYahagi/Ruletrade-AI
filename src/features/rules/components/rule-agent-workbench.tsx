import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  ClipboardCheck,
  Database,
  FileText,
  GitBranch,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { AttentionBadge } from "@/components/status/attention-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  agentDefinitions,
  type RuleSessionSummary,
  ruleStatusLabels,
  sampleInvestmentMemory,
  sampleRule,
} from "@/features/rules/model";
import { validateTradingRule } from "@/features/rules/services/trading-rule-validation";

const severityClassName = {
  info: "border-sky-200 bg-sky-50 text-sky-950",
  warning: "border-amber-200 bg-amber-50 text-amber-950",
  blocker: "border-rose-200 bg-rose-50 text-rose-950",
};

const ruleSessionStatusLabels: Record<string, string> = {
  draft: "下書き",
  in_progress: "作成中",
  needs_more_info: "追加情報待ち",
  quality_gate_passed: "レビュー通過",
  paused: "一時停止",
  finalized: "確定済み",
  archived: "アーカイブ",
};

const qualityGateStatusLabels: Record<string, string> = {
  not_reviewed: "未レビュー",
  pending: "確認中",
  passed: "通過",
  failed: "要修正",
  blocked: "ブロック",
};

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function AgentWorkbench({
  ruleSessions = [],
  attentionStatuses = {},
}: {
  ruleSessions?: RuleSessionSummary[];
  attentionStatuses?: Record<
    string,
    "on_track" | "needs_check" | "condition_met"
  >;
}) {
  const ruleValidation = validateTradingRule(sampleRule);

  return (
    <main
      className="min-h-screen bg-background text-foreground"
      data-testid="dashboard-workbench"
    >
      <section className="border-b bg-muted/30">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-8 sm:px-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-medium text-muted-foreground">
                Ruletrade-AI agent workbench
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal sm:text-4xl">
                AIと一緒に投資ルールを作成・レビューする
              </h1>
              <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
                生成、リスクレビュー、検証、説明、承認を分けて扱い、AIの提案をそのまま採用しない設計にします。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/today"
                className={buttonVariants({ variant: "outline" })}
                data-testid="dashboard-today-link"
              >
                Today
              </Link>
              <Button variant="outline">
                <GitBranch />
                Review flow
              </Button>
              <Link
                href="/rules/new"
                className={buttonVariants()}
                data-testid="dashboard-new-rule-button"
              >
                <ClipboardCheck />
                New rule
              </Link>
              <Link
                href="/portfolio"
                className={buttonVariants({ variant: "outline" })}
                data-testid="dashboard-portfolio-link"
              >
                <Database />
                ポートフォリオ
              </Link>
            </div>
          </div>

          <div className="rounded-lg border bg-background p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <FileText className="size-4 text-muted-foreground" />
                  <h2 className="text-sm font-medium">保存済み投資ルール</h2>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  作成中・確定済みのルールセッションを確認できます。
                </p>
              </div>
              <Link
                href="/rules/new"
                className={buttonVariants({ variant: "outline" })}
              >
                <ClipboardCheck />
                New rule
              </Link>
            </div>

            {ruleSessions.length > 0 ? (
              <div className="mt-4 divide-y rounded-lg border">
                {ruleSessions.map((session) => (
                  <Link
                    key={session.id}
                    href={`/rules/${session.id}`}
                    className="block p-4 transition hover:bg-muted/40"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-base font-medium">
                          {session.company_name
                            ? `${session.company_name} (${session.ticker})`
                            : session.ticker}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          質問 {session.question_count}/
                          {session.max_question_count} ・ 更新{" "}
                          {dateFormatter.format(new Date(session.updated_at))}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <AttentionBadge
                          status={
                            attentionStatuses[session.id] ?? "needs_check"
                          }
                        />
                        <span className="rounded-md border px-2 py-1 text-xs font-medium">
                          {ruleSessionStatusLabels[session.status] ??
                            session.status}
                        </span>
                        <span className="rounded-md border bg-muted/30 px-2 py-1 text-xs text-muted-foreground">
                          {qualityGateStatusLabels[
                            session.quality_gate_status
                          ] ?? session.quality_gate_status}
                        </span>
                        <span className="rounded-md border bg-muted/30 px-2 py-1 text-xs text-muted-foreground">
                          {session.completion_score}%
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
                まだ保存済みルールはありません。新しい投資ルールを作ると、ここに表示されます。
              </div>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-5">
            {agentDefinitions.map((agent) => (
              <Card key={agent.role} size="sm" className="rounded-lg">
                <CardHeader>
                  <CardTitle>{agent.name}</CardTitle>
                  <CardDescription>{agent.output}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-xs leading-5 text-muted-foreground">
                    {agent.responsibility}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-5 py-6 sm:px-8 lg:grid-cols-[320px_1fr_360px]">
        <aside className="space-y-5">
          <div className="rounded-lg border bg-background p-4">
            <div className="flex items-center gap-2">
              <BrainCircuit className="size-4 text-muted-foreground" />
              <h2 className="text-sm font-medium">User intent</h2>
            </div>
            <div className="mt-4 space-y-3">
              <label className="block text-xs font-medium text-muted-foreground">
                Market
                <Input className="mt-1" defaultValue="日本株" />
              </label>
              <label className="block text-xs font-medium text-muted-foreground">
                Horizon
                <Input className="mt-1" defaultValue="2から8週間" />
              </label>
              <label className="block text-xs font-medium text-muted-foreground">
                Strategy brief
                <Textarea
                  className="mt-1 min-h-28"
                  defaultValue="上昇トレンド中の押し目を狙うが、損切り条件と検証結果がないルールは採用しない。"
                />
              </label>
            </div>
          </div>

          <div className="rounded-lg border bg-background p-4">
            <div className="flex items-center gap-2">
              <Database className="size-4 text-muted-foreground" />
              <h2 className="text-sm font-medium">Shared memory</h2>
            </div>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">
                  Risk tolerance
                </dt>
                <dd className="mt-1 font-medium">
                  {sampleInvestmentMemory.riskTolerance}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  Preferred markets
                </dt>
                <dd className="mt-1">
                  {sampleInvestmentMemory.preferredMarkets.join(" / ")}
                </dd>
              </div>
            </dl>
            <ul className="mt-4 space-y-2">
              {sampleInvestmentMemory.standingConstraints.map((constraint) => (
                <li
                  key={constraint}
                  className="flex gap-2 text-xs leading-5 text-muted-foreground"
                >
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                  {constraint}
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <div className="space-y-5">
          <div className="rounded-lg border bg-background p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  {ruleStatusLabels[sampleRule.status]}
                </p>
                <h2 className="mt-1 text-xl font-semibold">
                  {sampleRule.title}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {sampleRule.market} / {sampleRule.timeframe} / risk{" "}
                  {sampleRule.riskLevel}
                </p>
              </div>
              <span className="w-fit rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-950">
                {ruleValidation.canApprove
                  ? "Ready for approval"
                  : "Approval blocked"}
              </span>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <RuleList
                title="Entry conditions"
                items={sampleRule.entryConditions}
              />
              <RuleList
                title="Exit conditions"
                items={sampleRule.exitConditions}
              />
              <RuleList title="Risk limits" items={sampleRule.riskLimits} />
              <RuleList title="Assumptions" items={sampleRule.assumptions} />
            </div>
          </div>

          <div className="rounded-lg border bg-background p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-muted-foreground" />
              <h2 className="text-sm font-medium">Evaluation evidence</h2>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <Metric
                label="Backtest window"
                value={sampleRule.evidence.backtestWindow}
              />
              <Metric
                label="Sample size"
                value={String(sampleRule.evidence.sampleSize)}
              />
              <Metric
                label="Max drawdown"
                value={sampleRule.evidence.expectedMaxDrawdown}
              />
              <Metric
                label="Confidence"
                value={sampleRule.evidence.confidence}
              />
            </div>
          </div>
        </div>

        <aside className="space-y-5">
          <div className="rounded-lg border bg-background p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-muted-foreground" />
              <h2 className="text-sm font-medium">AI review</h2>
            </div>
            <div className="mt-4 space-y-3">
              {ruleValidation.warnings.map((warning) => (
                <div
                  key={warning.id}
                  className={`rounded-lg border p-3 ${severityClassName[warning.severity]}`}
                >
                  <p className="text-sm font-medium">{warning.title}</p>
                  <p className="mt-1 text-xs leading-5">{warning.detail}</p>
                  <p className="mt-2 text-xs opacity-75">
                    Owner: {warning.owner}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border bg-background p-4">
            <h2 className="text-sm font-medium">Human approval boundary</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {sampleRule.approval.reason}
            </p>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="flex-1">
                Reject
              </Button>
              <Button className="flex-1" disabled={!ruleValidation.canApprove}>
                Approve
              </Button>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

function RuleList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <h3 className="text-sm font-medium">{title}</h3>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item} className="text-sm leading-6 text-muted-foreground">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

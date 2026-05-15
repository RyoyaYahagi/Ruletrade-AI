import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  ClipboardCheck,
  Database,
  GitBranch,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
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

export function AgentWorkbench() {
  const ruleValidation = validateTradingRule(sampleRule);

  return (
    <main className="min-h-screen bg-background text-foreground">
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
              <Button variant="outline">
                <GitBranch />
                Review flow
              </Button>
              <Button>
                <ClipboardCheck />
                New rule
              </Button>
            </div>
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

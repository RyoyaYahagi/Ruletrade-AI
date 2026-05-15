import type {
  AgentRole,
  InvestmentMemory,
  RuleStatus,
  TradingRule,
} from "@/schemas/rules/trading-rule";

export type AgentDefinition = {
  role: AgentRole;
  name: string;
  responsibility: string;
  output: string;
};

export const agentDefinitions: AgentDefinition[] = [
  {
    role: "orchestrator",
    name: "Orchestrator",
    responsibility:
      "ユーザー入力、共有記憶、各AIの成果物を結び、承認待ちを管理する。",
    output: "タスク状態と次の担当",
  },
  {
    role: "rule_generator",
    name: "Rule Generator",
    responsibility:
      "投資方針からエントリー、イグジット、リスク管理を構造化して起案する。",
    output: "構造化ルール案",
  },
  {
    role: "risk_reviewer",
    name: "Risk Reviewer",
    responsibility:
      "矛盾、未来情報、損切り不在、過剰最適化、説明との不一致を検出する。",
    output: "警告とブロッカー",
  },
  {
    role: "backtest_evaluator",
    name: "Backtest Evaluator",
    responsibility:
      "検証期間、サンプル数、ドローダウン、未検証領域を記録する。",
    output: "評価証跡",
  },
  {
    role: "explanation_writer",
    name: "Explanation Writer",
    responsibility: "構造化ルールをユーザーが承認判断しやすい文章へ変換する。",
    output: "承認用サマリー",
  },
];

export const ruleStatusLabels: Record<RuleStatus, string> = {
  draft: "Draft",
  in_review: "In review",
  blocked: "Blocked",
  approved: "Approved",
  rejected: "Rejected",
};

export const sampleInvestmentMemory: InvestmentMemory = {
  riskTolerance: "medium",
  preferredMarkets: ["日本株", "米国大型株", "ETF"],
  timeHorizons: ["スイング", "中期"],
  rejectedPatterns: [
    "根拠のないナンピン",
    "損切り条件なし",
    "短すぎる検証期間",
  ],
  standingConstraints: [
    "実運用前にユーザー承認を必須にする",
    "最大損失と撤退条件を常に明記する",
    "バックテスト未実施のルールは承認不可にする",
  ],
};

export const sampleRule: TradingRule = {
  id: "rule-draft-001",
  title: "上昇トレンド押し目買いルール",
  status: "blocked",
  market: "日本株",
  timeframe: "日足 / 2から8週間",
  riskLevel: "medium",
  entryConditions: [
    "終値が50日移動平均線を上回る",
    "20日高値から8%以内の押し目を形成",
    "出来高が20日平均以上に回復",
  ],
  exitConditions: [
    "終値が20日移動平均線を2営業日連続で下回る",
    "エントリー価格から7%下落",
  ],
  riskLimits: [
    "1ルールあたり口座資産の1.0%を最大損失に制限",
    "同一セクターの同時保有は3銘柄まで",
  ],
  assumptions: [
    "流動性が十分な銘柄のみ対象",
    "決算発表前後の新規エントリーは避ける",
  ],
  evidence: {
    backtestWindow: "未検証",
    sampleSize: 0,
    expectedMaxDrawdown: "未算出",
    confidence: "unverified",
  },
  warnings: [
    {
      id: "warn-backtest-missing",
      severity: "blocker",
      title: "バックテスト未実施",
      detail: "検証期間とサンプル数がないため、承認前に評価が必要です。",
      owner: "backtest_evaluator",
    },
    {
      id: "warn-earnings-filter",
      severity: "warning",
      title: "イベント回避条件が曖昧",
      detail: "決算前後を何営業日除外するかを明文化してください。",
      owner: "risk_reviewer",
    },
  ],
  approval: {
    required: true,
    reason: "AIは提案と検証までを担当し、採用判断はユーザーが行うため。",
  },
};

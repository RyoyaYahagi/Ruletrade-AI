export type GlossaryTermKey =
  | "investment_hypothesis"
  | "investment_period"
  | "target_price_range"
  | "split_purchase"
  | "max_investment_amount"
  | "max_investment_ratio"
  | "take_profit"
  | "stop_loss"
  | "exit_condition"
  | "additional_purchase"
  | "earnings_overnight"
  | "unresolved_item"
  | "completion_score"
  | "quality_check"
  | "warning"
  | "blocker"
  | "backtest"
  | "evaluation_period"
  | "future_data_leakage";

export type GlossaryCategory = "rule" | "risk" | "review" | "evaluation";

export type GlossaryTerm = {
  key: GlossaryTermKey;
  label: string;
  shortDescription: string;
  longDescription?: string;
  category: GlossaryCategory;
  relatedTerms?: GlossaryTermKey[];
};

export const glossaryTerms: Record<GlossaryTermKey, GlossaryTerm> = {
  investment_hypothesis: {
    key: "investment_hypothesis",
    label: "投資仮説",
    shortDescription:
      "なぜその銘柄を選び、どういう条件で上昇を期待するかを言葉にしたものです。根拠が明確だとルールの見直しがしやすくなります。",
    category: "rule",
    relatedTerms: ["target_price_range", "evaluation_period"],
  },
  investment_period: {
    key: "investment_period",
    label: "投資期間",
    shortDescription:
      "銘柄をどのくらいの期間保有する想定かです。短期・中期・長期の目安を決めておくと、見直しのタイミングが分かりやすくなります。",
    category: "rule",
    relatedTerms: ["exit_condition", "evaluation_period"],
  },
  target_price_range: {
    key: "target_price_range",
    label: "買いたい価格帯",
    shortDescription:
      "購入を検討する価格の範囲です。高すぎず安すぎず、自分の資金とリスクに合った帯を決めます。",
    category: "rule",
    relatedTerms: ["split_purchase", "max_investment_amount"],
  },
  split_purchase: {
    key: "split_purchase",
    label: "分割買い",
    shortDescription:
      "1回で全額購入せず、数回に分けて買う方法です。価格変動のリスクを分散できます。",
    category: "rule",
    relatedTerms: ["target_price_range", "additional_purchase"],
  },
  max_investment_amount: {
    key: "max_investment_amount",
    label: "最大投資額",
    shortDescription:
      "この銘柄に使う資金の絶対額の上限です。余裕のある範囲で決め、生活資金に影響を与えないようにします。",
    category: "risk",
    relatedTerms: ["max_investment_ratio"],
  },
  max_investment_ratio: {
    key: "max_investment_ratio",
    label: "最大投資比率",
    shortDescription:
      "資金全体に対して、この銘柄に使う割合の上限です。1つの銘柄に集中しすぎないために決めます。",
    category: "risk",
    relatedTerms: ["max_investment_amount"],
  },
  take_profit: {
    key: "take_profit",
    label: "利確",
    shortDescription:
      "利益が出たときに、一部または全部を売却する条件です。目標をあらかじめ決めておくと、感情に左右されにくくなります。",
    category: "rule",
    relatedTerms: ["stop_loss", "exit_condition"],
  },
  stop_loss: {
    key: "stop_loss",
    label: "損切り",
    shortDescription:
      "想定外に下がったとき、どの条件で見直すかを決めておく項目です。損失が拡大しすぎる前に行動しやすくなります。",
    category: "risk",
    relatedTerms: ["take_profit", "exit_condition"],
  },
  exit_condition: {
    key: "exit_condition",
    label: "撤退条件",
    shortDescription:
      "銘柄を売却または見直すための条件です。利確・損切りのほか、投資仮説が崩れた場合なども含みます。",
    category: "rule",
    relatedTerms: ["take_profit", "stop_loss", "investment_hypothesis"],
  },
  additional_purchase: {
    key: "additional_purchase",
    label: "買い増し",
    shortDescription:
      "保有中に追加で購入することです。事前に条件を決めておかないと、感情で追いかけ買いしやすくなります。",
    category: "rule",
    relatedTerms: ["split_purchase", "max_investment_ratio"],
  },
  earnings_overnight: {
    key: "earnings_overnight",
    label: "決算跨ぎ",
    shortDescription:
      "決算発表日をまたいで銘柄を保有することです。予想外の結果で大きく変動する可能性があるため、リスクを理解しておきます。",
    category: "risk",
    relatedTerms: ["evaluation_period"],
  },
  unresolved_item: {
    key: "unresolved_item",
    label: "未解決項目",
    shortDescription:
      "ルール作成の途中でまだ決められていない項目です。AIが質問したり、レビューで指摘したりする対象になります。",
    category: "review",
    relatedTerms: ["completion_score"],
  },
  completion_score: {
    key: "completion_score",
    label: "完成度スコア",
    shortDescription:
      "ルールの決まっている項目の割合を示す指標です。100%であっても必ずしも安全ではありませんが、抜け漏れを減らす助けになります。",
    category: "review",
    relatedTerms: ["unresolved_item", "quality_check"],
  },
  quality_check: {
    key: "quality_check",
    label: "Quality Check",
    shortDescription:
      "ルールの品質を確認する自動チェックです。矛盾や抜け、危険な設定がないかを機械的に検証します。",
    category: "review",
    relatedTerms: ["warning", "blocker"],
  },
  warning: {
    key: "warning",
    label: "Warning",
    shortDescription:
      "ルールに改善余地があることを示す指摘です。必ずしも即座に修正が必要ではありませんが、無視しすぎるとリスクが高まることがあります。",
    category: "review",
    relatedTerms: ["blocker", "quality_check"],
  },
  blocker: {
    key: "blocker",
    label: "Blocker",
    shortDescription:
      "ルールの承認を妨げる重大な問題です。未設定の重要項目や明らかな矛盾が該当します。解消しないと次のステップに進めません。",
    category: "review",
    relatedTerms: ["warning", "quality_check"],
  },
  backtest: {
    key: "backtest",
    label: "バックテスト",
    shortDescription:
      "過去のデータを使って、ルールがどのように動作したかをシミュレーションすることです。あくまで過去の結果であり、将来を保証するものではありません。",
    category: "evaluation",
    relatedTerms: ["evaluation_period"],
  },
  evaluation_period: {
    key: "evaluation_period",
    label: "評価期間",
    shortDescription:
      "バックテストや検証に使う期間です。短すぎると偶然の影響が大きく、長すぎると市場環境の変化を反映しにくくなります。",
    category: "evaluation",
    relatedTerms: ["backtest", "investment_period"],
  },
  future_data_leakage: {
    key: "future_data_leakage",
    label: "未来データ参照",
    shortDescription:
      "過去の検証で、当時にはまだ知り得なかった情報を使ってしまうことです。ルールの評価を過大に見せるため、注意が必要です。",
    category: "evaluation",
    relatedTerms: ["backtest", "quality_check"],
  },
};

export function getGlossaryTerm(
  key: GlossaryTermKey,
): GlossaryTerm | undefined {
  return glossaryTerms[key];
}

export function getGlossaryTermsByCategory(
  category: GlossaryCategory,
): GlossaryTerm[] {
  return Object.values(glossaryTerms).filter((t) => t.category === category);
}

export function getAllGlossaryTermKeys(): GlossaryTermKey[] {
  return Object.keys(glossaryTerms) as GlossaryTermKey[];
}

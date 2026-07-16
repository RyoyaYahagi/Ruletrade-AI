export type QuestionCatalogEntry = {
  question_key: string;
  question_text: string;
  question_type: string;
  options?: unknown;
  help_text?: string;
  priority: number;
  is_required: boolean;
  maps_to_rule_field?: string;
  source: "template" | "system";
  display_order: number;
  allow_unknown: boolean;
  unknown_default_json?: {
    value: unknown;
    label: string;
    explanation: string;
  } | null;
};

export const FALLBACK_BREAKER_CANDIDATES = [
  {
    label: "業績が2四半期連続で悪化する",
    value: "業績が2四半期連続で悪化する",
  },
  {
    label: "主力製品・サービスの競争力低下が確認される",
    value: "主力製品・サービスの競争力低下が確認される",
  },
  {
    label: "経営陣やガバナンスに重大な問題が確認される",
    value: "経営陣やガバナンスに重大な問題が確認される",
  },
  {
    label: "この銘柄を持つ理由を自分で説明できなくなる",
    value: "この銘柄を持つ理由を自分で説明できなくなる",
  },
] as const;

const percentageOptions = {
  min: 5,
  max: 40,
  step: 5,
  presets: [
    { label: "控えめ", value: 10 },
    { label: "標準", value: 15 },
    { label: "幅を持たせる", value: 20 },
  ],
};

export const RULE_QUESTION_CATALOG: QuestionCatalogEntry[] = [
  {
    question_key: "holding_purpose",
    question_text: "この銘柄を持つ一番の目的は？",
    question_type: "single_choice",
    options: [
      { label: "長期的な成長を見守る", value: "long_term_growth" },
      { label: "割安に見える理由を検証する", value: "value" },
      { label: "配当や優待を受け取る", value: "dividend" },
      { label: "短期の値動きを記録する", value: "short_term_trade" },
      { label: "学習のために少額で試す", value: "learning" },
    ],
    help_text: "複数の目的がある場合は、いちばん大きいものを選んでください。",
    priority: 4,
    is_required: true,
    maps_to_rule_field: "purpose",
    source: "template",
    display_order: 1,
    allow_unknown: true,
    unknown_default_json: {
      value: "learning",
      label: "学習のために少額で試す",
      explanation: "目的がまだ固まっていないときは、学習対象として整理できます。",
    },
  },
  {
    question_key: "time_horizon",
    question_text: "どれくらいの期間で考えていますか？",
    question_type: "single_choice",
    options: [
      { label: "数週間〜数か月", value: "short_term" },
      { label: "数か月〜1年", value: "medium_term" },
      { label: "1年以上", value: "long_term" },
    ],
    priority: 4,
    is_required: true,
    maps_to_rule_field: "timeHorizon",
    source: "template",
    display_order: 2,
    allow_unknown: true,
    unknown_default_json: {
      value: "long_term",
      label: "1年以上",
      explanation: "期間を決めきれない場合は、短期の期限を置かずに整理できます。",
    },
  },
  {
    question_key: "thesis_seed",
    question_text:
      "この銘柄を持つ理由に近いものを全部選んでください（複数選択可）",
    question_type: "multiple_choice",
    options: [
      { label: "事業が成長しそう", value: "事業の成長" },
      { label: "株価が割安に見える", value: "割安に見える" },
      { label: "配当や優待", value: "配当や優待" },
      { label: "応援したい・好き", value: "応援したい・好き" },
      { label: "話題になっている", value: "話題になっている" },
      { label: "その他", value: "その他" },
    ],
    help_text: "選択した理由は、次の仮説の下書きで整理します。",
    priority: 4,
    is_required: false,
    source: "template",
    display_order: 3,
    allow_unknown: true,
    unknown_default_json: {
      value: [],
      label: "理由を未選択のまま進む",
      explanation: "理由がまだ言葉になっていなくても、仮説欄で後から整理できます。",
    },
  },
  {
    question_key: "thesis_draft",
    question_text: "あなたの投資仮説（AIが下書きを作成、編集して確定）",
    question_type: "free_text",
    help_text: "下書きを確認し、自分の言葉に直してから保存してください。",
    priority: 5,
    is_required: true,
    maps_to_rule_field: "investmentThesis",
    source: "template",
    display_order: 4,
    allow_unknown: false,
    unknown_default_json: null,
  },
  {
    question_key: "thesis_breakers_pick",
    question_text: "どうなったら「見立てが外れた」と考えますか？",
    question_type: "multiple_choice",
    options: FALLBACK_BREAKER_CANDIDATES,
    help_text: "観測できる事実を選んでください。複数選択できます。",
    priority: 4,
    is_required: true,
    maps_to_rule_field: "thesisBreakers",
    source: "template",
    display_order: 5,
    allow_unknown: true,
    unknown_default_json: {
      value: FALLBACK_BREAKER_CANDIDATES.map((candidate) => candidate.value),
      label: "一般的な確認項目を使う",
      explanation: "迷う場合は、業績・競争力・ガバナンス・保有理由の4点を確認項目にします。",
    },
  },
  {
    question_key: "stop_loss_review",
    question_text: "買値からどれくらい下がったら一度見直しますか？",
    question_type: "percent_slider",
    options: percentageOptions,
    help_text: "設定値は通知条件です。売買は実行せず、ルールの確認を促します。",
    priority: 4,
    is_required: true,
    maps_to_rule_field: "monitoring.stopLossReviewPercent",
    source: "template",
    display_order: 6,
    allow_unknown: true,
    unknown_default_json: {
      value: 15,
      label: "15%で見直す",
      explanation: "迷う場合の入力例として、10〜20%程度の設定を表示します。",
    },
  },
  {
    question_key: "take_profit_review",
    question_text: "どれくらい上がったら一度見直しますか？",
    question_type: "percent_slider",
    options: {
      min: 10,
      max: 100,
      step: 10,
      presets: [
        { label: "10%", value: 10 },
        { label: "30%", value: 30 },
        { label: "決めない", value: null },
      ],
    },
    help_text: "利益側の通知条件は、決めずに下落側だけ設定することもできます。",
    priority: 3,
    is_required: true,
    maps_to_rule_field: "monitoring.takeProfitReviewPercent",
    source: "template",
    display_order: 7,
    allow_unknown: true,
    unknown_default_json: {
      value: null,
      label: "利益側は未設定",
      explanation: "上昇時の通知条件を決めず、他の条件だけで確認できます。",
    },
  },
  {
    question_key: "max_position",
    question_text: "資産全体のうち、この銘柄に最大何%まで入れますか？",
    question_type: "percent_slider",
    options: {
      min: 1,
      max: 30,
      step: 1,
      presets: [
        { label: "5%", value: 5 },
        { label: "10%", value: 10 },
        { label: "20%", value: 20 },
      ],
    },
    help_text: "これは本人が決めた上限を記録する項目です。",
    priority: 4,
    is_required: true,
    maps_to_rule_field: "riskManagement.maxPositionPercent",
    source: "template",
    display_order: 8,
    allow_unknown: true,
    unknown_default_json: {
      value: 10,
      label: "最大10%",
      explanation: "集中度を確認するための入力例として、10%を表示します。",
    },
  },
  {
    question_key: "earnings_policy",
    question_text: "決算発表の前後はどうしますか？",
    question_type: "single_choice",
    options: [
      { label: "決算をまたいで保有する", value: "hold_through" },
      { label: "決算前に確認する", value: "review_before_earnings" },
      { label: "決算前は保有しない", value: "avoid_before_earnings" },
    ],
    priority: 3,
    is_required: true,
    maps_to_rule_field: "earningsPolicy.policy",
    source: "template",
    display_order: 9,
    allow_unknown: true,
    unknown_default_json: {
      value: "review_before_earnings",
      label: "決算前に確認する",
      explanation: "決算をどう扱うか未定の場合は、確認項目として残せます。",
    },
  },
  {
    question_key: "review_cycle",
    question_text: "このルールをどの頻度で見直しますか？",
    question_type: "single_choice",
    options: [
      { label: "毎月", value: "monthly" },
      { label: "四半期ごと", value: "quarterly" },
      { label: "決算後", value: "after_earnings" },
    ],
    priority: 3,
    is_required: true,
    maps_to_rule_field: "monitoring.reviewCycle",
    source: "template",
    display_order: 10,
    allow_unknown: true,
    unknown_default_json: {
      value: "quarterly",
      label: "四半期ごと",
      explanation: "決算などの節目に合わせて確認する周期として記録します。",
    },
  },
];

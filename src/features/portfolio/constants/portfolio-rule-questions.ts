// ポートフォリオ共通ルールの固定質問。
// 文言は投資助言にならないよう「本人の許容度を言葉にする」形に固定し、
// AIには回答の解釈と参考案の生成だけを任せる。
export type PortfolioRuleQuestionOption = {
  value: string;
  label: string;
};

export type PortfolioRuleQuestion = {
  key: string;
  text: string;
  explanation: string;
  multiSelect?: boolean;
  options: PortfolioRuleQuestionOption[];
};

export const PORTFOLIO_RULE_QUESTIONS: PortfolioRuleQuestion[] = [
  {
    key: "risk_tolerance",
    text: "資産全体が2割下がったとき、あなたの気持ちに一番近いのはどれですか？",
    explanation:
      "例えば100万円が80万円になった場面を想像します。正解はなく、無理なく続けられるかが基準です。",
    options: [
      { value: "conservative", label: "不安で売りたくなると思う" },
      { value: "balanced", label: "前提が変わらなければ持ち続けられそう" },
      { value: "aggressive", label: "むしろ買い増しを考えたい" },
      { value: "undecided", label: "まだわからない" },
    ],
  },
  {
    key: "max_position_count",
    text: "値動きやニュースを無理なく追える銘柄数は、いくつくらいですか？",
    explanation:
      "保有数が増えるほど1銘柄に使える注意は減ります。管理できる数から逆算して考えます。",
    options: [
      { value: "5", label: "5銘柄くらいまで" },
      { value: "10", label: "10銘柄くらいまで" },
      { value: "20", label: "20銘柄くらいまで" },
      { value: "undecided", label: "まだ決めない" },
    ],
  },
  {
    key: "max_position_percent",
    text: "1つの銘柄に、資産全体のどこまでなら任せられますか？",
    explanation:
      "例えばその銘柄が半分になったとき、資産全体がどれだけ減るかで考えます。",
    options: [
      { value: "10", label: "1割くらいまで" },
      { value: "20", label: "2割くらいまで" },
      { value: "30plus", label: "3割以上でも構わない" },
      { value: "undecided", label: "まだ決めない" },
    ],
  },
  {
    key: "group_concentration",
    text: "同じ業界・テーマの銘柄が一斉に下がったとき、資産のどこまでなら想定内ですか？",
    explanation:
      "半導体やAIのように、同じ材料で一緒に動くグループ単位で考えます。",
    options: [
      { value: "20", label: "2割くらいまで" },
      { value: "40", label: "3〜4割くらいまで" },
      { value: "50plus", label: "半分以上でも構わない" },
      { value: "undecided", label: "まだ決めない" },
    ],
  },
  {
    key: "max_market_percent",
    text: "日本株・米国株など、個別株の1つの市場への集中はどこまで許容しますか？",
    explanation:
      "同じ国の個別株は景気や為替の影響で一緒に動きやすいため、市場比率は個別株だけで確認します。投資信託・ETFはこの判定から除きます。",
    options: [
      { value: "50", label: "半分くらいまで" },
      { value: "70", label: "7割くらいまで" },
      { value: "no_limit", label: "1つの市場に集中してよい" },
      { value: "undecided", label: "まだ決めない" },
    ],
  },
  {
    key: "min_cash_percent",
    text: "急な出費や「安くなったら買いたい」に備えて、現金はどのくらい残したいですか？",
    explanation:
      "現金は生活の守りと、次の機会に動くための余力の両方に使えます。",
    options: [
      { value: "30", label: "3割以上は残したい" },
      { value: "15", label: "1〜2割くらい" },
      { value: "minimal", label: "ほとんど投資に回したい" },
      { value: "undecided", label: "まだ決めない" },
    ],
  },
  {
    key: "core_satellite",
    text: "積立中の投資信託・ETFを土台（コア）にする場合、個別株に回すのは資産全体のどこまでにしますか？",
    explanation:
      "投信で広く分散した土台を守りつつ、個別株はサテライト（衛星）として上限を決める考え方です。",
    options: [
      { value: "10", label: "1割くらいまで" },
      { value: "25", label: "2〜3割くらいまで" },
      { value: "50", label: "半分くらいまで" },
      { value: "no_fund", label: "投資信託・ETFは持っていない" },
      { value: "undecided", label: "まだ決めない" },
    ],
  },
  {
    key: "excluded_asset_types",
    text: "最初から「買わない」と決めておきたいものはありますか？",
    explanation:
      "迷いを減らすためのルールです。あとから外すこともできます。",
    multiSelect: true,
    options: [
      { value: "レバレッジ型商品", label: "レバレッジ型商品" },
      { value: "暗号資産", label: "暗号資産" },
      { value: "FX・信用取引", label: "FX・信用取引" },
      { value: "none", label: "特になし" },
    ],
  },
  {
    key: "max_single_trade_loss_percent",
    text: "1回の取引の失敗を「勉強代」と思える上限は、資産全体のどのくらいですか？",
    explanation:
      "例えば資産100万円で1%なら、1回の損失は1万円までという意味になります。",
    options: [
      { value: "0.5", label: "0.5%くらいまで" },
      { value: "1", label: "1%くらいまで" },
      { value: "2", label: "2%くらいまで" },
      { value: "undecided", label: "まだ決めない" },
    ],
  },
];

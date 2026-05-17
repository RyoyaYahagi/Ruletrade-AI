export type ProhibitedPhraseRule = {
  type:
    | "buy_recommendation"
    | "sell_recommendation"
    | "price_prediction"
    | "profit_guarantee"
    | "loss_avoidance_guarantee"
    | "decision_delegation"
    | "privacy_risk"
    | "urgency_pressure"
    | "fear_mongering"
    | "other";

  phrase: string;
  reason: string;
  riskLevel: "low" | "medium" | "high";
};

export const PROHIBITED_PHRASE_RULES: ProhibitedPhraseRule[] = [
  {
    type: "buy_recommendation",
    phrase: "買うべき",
    reason: "個別銘柄の買い推奨に見える表現です。",
    riskLevel: "high",
  },
  {
    type: "buy_recommendation",
    phrase: "今すぐ買",
    reason: "購入を急かす買い推奨表現です。",
    riskLevel: "high",
  },
  {
    type: "buy_recommendation",
    phrase: "購入をおすすめ",
    reason: "購入推奨に見える表現です。",
    riskLevel: "high",
  },
  {
    type: "buy_recommendation",
    phrase: "買い一択",
    reason: "強い買い推奨表現です。",
    riskLevel: "high",
  },
  {
    type: "sell_recommendation",
    phrase: "売るべき",
    reason: "個別銘柄の売り推奨に見える表現です。",
    riskLevel: "high",
  },
  {
    type: "sell_recommendation",
    phrase: "今すぐ売",
    reason: "売却を急かす表現です。",
    riskLevel: "high",
  },
  {
    type: "sell_recommendation",
    phrase: "売却をおすすめ",
    reason: "売却推奨に見える表現です。",
    riskLevel: "high",
  },
  {
    type: "sell_recommendation",
    phrase: "損切りして",
    reason: "売却を促す表現です。",
    riskLevel: "high",
  },
  {
    type: "price_prediction",
    phrase: "必ず上が",
    reason: "将来株価を断定する表現です。",
    riskLevel: "high",
  },
  {
    type: "price_prediction",
    phrase: "確実に上昇",
    reason: "将来の価格変動を断定する表現です。",
    riskLevel: "high",
  },
  {
    type: "price_prediction",
    phrase: "株価は2倍",
    reason: "将来株価の断定に見える表現です。",
    riskLevel: "high",
  },
  {
    type: "price_prediction",
    phrase: "下がることはありません",
    reason: "将来株価を断定する表現です。",
    riskLevel: "high",
  },
  {
    type: "profit_guarantee",
    phrase: "利益が出ます",
    reason: "利益保証に見える表現です。",
    riskLevel: "high",
  },
  {
    type: "profit_guarantee",
    phrase: "儲かります",
    reason: "利益を保証するように見える表現です。",
    riskLevel: "high",
  },
  {
    type: "profit_guarantee",
    phrase: "高確率で勝てます",
    reason: "利益を保証するように見える表現です。",
    riskLevel: "high",
  },
  {
    type: "loss_avoidance_guarantee",
    phrase: "損しません",
    reason: "損失回避を保証する表現です。",
    riskLevel: "high",
  },
  {
    type: "loss_avoidance_guarantee",
    phrase: "リスクはありません",
    reason: "投資リスクがないように見える表現です。",
    riskLevel: "high",
  },
  {
    type: "loss_avoidance_guarantee",
    phrase: "安全です",
    reason: "安全を保証する表現です。",
    riskLevel: "high",
  },
  {
    type: "decision_delegation",
    phrase: "実行してください",
    reason: "投資判断の実行を促す表現です。",
    riskLevel: "high",
  },
  {
    type: "decision_delegation",
    phrase: "判断はこれで決まり",
    reason: "ユーザーの投資判断を代行する表現です。",
    riskLevel: "high",
  },
  {
    type: "decision_delegation",
    phrase: "この条件なら購入決定",
    reason: "投資判断を代行する表現です。",
    riskLevel: "high",
  },
  {
    type: "urgency_pressure",
    phrase: "今すぐ",
    reason: "ユーザーを急かす可能性がある表現です。",
    riskLevel: "medium",
  },
  {
    type: "urgency_pressure",
    phrase: "急いで",
    reason: "ユーザーを急かす可能性がある表現です。",
    riskLevel: "medium",
  },
  {
    type: "urgency_pressure",
    phrase: "迷わず",
    reason: "慎重な判断を妨げる可能性がある表現です。",
    riskLevel: "medium",
  },
  {
    type: "fear_mongering",
    phrase: "手遅れ",
    reason: "不安を煽る可能性がある表現です。",
    riskLevel: "medium",
  },
  {
    type: "fear_mongering",
    phrase: "大損します",
    reason: "不安を煽る可能性がある表現です。",
    riskLevel: "medium",
  },
  {
    type: "fear_mongering",
    phrase: "致命的",
    reason: "不安を煽る可能性がある表現です。",
    riskLevel: "medium",
  },
  {
    type: "privacy_risk",
    phrase: "証券口座のパスワード",
    reason: "秘密情報の入力を求める表現です。",
    riskLevel: "high",
  },
  {
    type: "privacy_risk",
    phrase: "取引暗証番号",
    reason: "取引に関する秘密情報の入力を求める表現です。",
    riskLevel: "high",
  },
  {
    type: "privacy_risk",
    phrase: "APIキーを貼",
    reason: "APIキーの入力を求める表現です。",
    riskLevel: "high",
  },
  {
    type: "privacy_risk",
    phrase: "銀行口座番号",
    reason: "銀行口座情報の入力を求める表現です。",
    riskLevel: "high",
  },
  {
    type: "privacy_risk",
    phrase: "マイナンバーを入力",
    reason: "個人番号の入力を求める表現です。",
    riskLevel: "high",
  },
];

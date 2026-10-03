import { japanDate } from "@/features/transactions/matching";
import type { Decision, DecisionType } from "@/schemas/decision";

export const decisionTypeLabel: Record<DecisionType, string> = {
  buy: "購入",
  add: "買い増し",
  sell_consideration: "売却を検討",
  sell: "売却",
  thesis_update: "仮説の更新",
  note: "メモ",
};

const decisionTypeTone: Record<DecisionType, string> = {
  buy: "bg-accent text-accent-foreground",
  add: "bg-accent text-accent-foreground",
  sell_consideration: "bg-attention-soft text-attention",
  sell: "bg-muted text-foreground",
  thesis_update: "bg-muted text-foreground",
  note: "bg-muted text-foreground",
};

export function decisionTypeTagClass(type: DecisionType): string {
  return `inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${decisionTypeTone[type]}`;
}

export function decisionDisplayText(
  decision: Pick<Decision, "summary" | "thesis" | "rawInput">,
): string {
  return decision.summary ?? decision.thesis ?? decision.rawInput;
}

/** 判断日（未設定なら作成日）を日本時間の「M/D」で返す。 */
export function shortJapanDate(value: string): string {
  const [, month, day] = japanDate(value).split("-");
  return `${Number(month)}/${Number(day)}`;
}

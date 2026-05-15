import {
  PROHIBITED_PHRASE_RULES,
  type ProhibitedPhraseRule,
} from "@/lib/safety/prohibited-phrases";

export type DetectedProhibitedPhrase = {
  type: ProhibitedPhraseRule["type"];
  phrase: string;
  reason: string;
  riskLevel: ProhibitedPhraseRule["riskLevel"];
};

export function detectProhibitedPhrases(
  text: string,
): DetectedProhibitedPhrase[] {
  const normalizedText = normalizeText(text);

  return PROHIBITED_PHRASE_RULES.filter((rule) => {
    return normalizedText.includes(normalizeText(rule.phrase));
  }).map((rule) => ({
    type: rule.type,
    phrase: rule.phrase,
    reason: rule.reason,
    riskLevel: rule.riskLevel,
  }));
}

function normalizeText(text: string) {
  // TODO: 全角・半角統一、ゼロ幅スペース除去、その他記号の対応を追加予定
  return text
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/\u200B/g, "")
    .replace(/[！!。．.、,]/g, "");
}

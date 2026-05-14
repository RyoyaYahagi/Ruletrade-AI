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
  text: string
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
  return text
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[！!。．.、,]/g, "");
}

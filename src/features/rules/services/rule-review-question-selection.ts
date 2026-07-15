export type ReviewNextQuestionCandidate = {
  questionKey: string;
  questionText: string;
  questionType: string;
  options?: unknown;
  helpText?: string;
  priority: number;
  isRequired: boolean;
  mapsToRuleField?: string;
};

export type ExistingRuleQuestion = {
  question_key: string;
  question_text: string;
};

export type ReviewQualityCheckQuestionCandidate = {
  checkKey: string;
  label: string;
  severity: "low" | "medium" | "high" | string;
  suggestedQuestion?: string;
};

export function buildQuestionsFromQualityChecks(
  qualityChecks: ReviewQualityCheckQuestionCandidate[],
): ReviewNextQuestionCandidate[] {
  return qualityChecks
    .filter((check) => check.suggestedQuestion?.trim())
    .map((check) => ({
      questionKey: `quality_check_${check.checkKey}`,
      questionText: check.suggestedQuestion?.trim() ?? "",
      questionType: "free_text",
      helpText: `${check.label}について、あなたの判断基準を追記してください。`,
      priority:
        check.severity === "high" ? 5 : check.severity === "medium" ? 4 : 3,
      isRequired: true,
      mapsToRuleField: undefined,
    }));
}

export function selectNewReviewQuestions(params: {
  nextQuestions: ReviewNextQuestionCandidate[];
  existingQuestions: ExistingRuleQuestion[];
  maxQuestionCount: number;
}) {
  const remainingQuestionSlots = Math.max(
    0,
    params.maxQuestionCount - params.existingQuestions.length,
  );
  const existingQuestionKeys = new Set(
    params.existingQuestions.map((question) => question.question_key),
  );
  const existingQuestionTexts = new Set(
    params.existingQuestions.map((question) => question.question_text),
  );

  const selected: ReviewNextQuestionCandidate[] = [];

  for (const question of params.nextQuestions) {
    if (
      existingQuestionKeys.has(question.questionKey) ||
      existingQuestionTexts.has(question.questionText)
    ) {
      continue;
    }

    selected.push(question);
    existingQuestionKeys.add(question.questionKey);
    existingQuestionTexts.add(question.questionText);

    if (selected.length >= remainingQuestionSlots) break;
  }

  return selected;
}

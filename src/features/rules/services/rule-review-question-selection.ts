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

  return params.nextQuestions
    .filter(
      (question) =>
        !existingQuestionKeys.has(question.questionKey) &&
        !existingQuestionTexts.has(question.questionText),
    )
    .slice(0, remainingQuestionSlots);
}

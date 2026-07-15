import { describe, expect, it } from "vitest";
import {
  buildQuestionsFromQualityChecks,
  selectNewReviewQuestions,
} from "@/features/rules/services/rule-review-question-selection";

const candidate = (key: string, text = key) => ({
  questionKey: key,
  questionText: text,
  questionType: "free_text",
  priority: 3,
  isRequired: true,
});

describe("selectNewReviewQuestions", () => {
  it("keeps adding new review questions when an existing pending question remains", () => {
    const selected = selectNewReviewQuestions({
      nextQuestions: [
        candidate("entry_condition", "買う条件は何ですか？"),
        candidate("risk_limit", "最大投資額はどれくらいですか？"),
      ],
      existingQuestions: [
        {
          question_key: "investment_thesis",
          question_text: "この銘柄を買いたい理由は何ですか？",
        },
      ],
      maxQuestionCount: 3,
    });

    expect(selected.map((question) => question.questionKey)).toEqual([
      "entry_condition",
      "risk_limit",
    ]);
  });

  it("deduplicates by key and text before applying the remaining question limit", () => {
    const selected = selectNewReviewQuestions({
      nextQuestions: [
        candidate("investment_thesis", "別の文面"),
        candidate("new_key", "この銘柄を買いたい理由は何ですか？"),
        candidate("entry_condition", "買う条件は何ですか？"),
        candidate("risk_limit", "最大投資額はどれくらいですか？"),
      ],
      existingQuestions: [
        {
          question_key: "investment_thesis",
          question_text: "この銘柄を買いたい理由は何ですか？",
        },
        {
          question_key: "time_horizon",
          question_text: "どれくらいの期間で考えていますか？",
        },
      ],
      maxQuestionCount: 3,
    });

    expect(selected.map((question) => question.questionKey)).toEqual([
      "entry_condition",
    ]);
  });

  it("builds answerable questions from quality check suggested questions", () => {
    const selected = selectNewReviewQuestions({
      nextQuestions: buildQuestionsFromQualityChecks([
        {
          checkKey: "exit_specificity",
          label: "イグジット条件",
          severity: "medium",
          suggestedQuestion: "投資仮説が崩れたと判断する条件を教えてください。",
        },
      ]),
      existingQuestions: [],
      maxQuestionCount: 12,
    });

    expect(selected).toMatchObject([
      {
        questionKey: "quality_check_exit_specificity",
        questionText: "投資仮説が崩れたと判断する条件を教えてください。",
        questionType: "free_text",
        priority: 4,
        isRequired: true,
      },
    ]);
  });
});

"use client";

export function AnswerInput({
  question,
  answerText,
  answerJson,
  onAnswerTextChange,
  onAnswerJsonChange,
}: {
  question: {
    question_type: string;
    options?: unknown;
  };
  answerText: string;
  answerJson: Record<string, unknown>;
  onAnswerTextChange: (value: string) => void;
  onAnswerJsonChange: (value: Record<string, unknown>) => void;
}) {
  const choiceOptions = Array.isArray(question.options)
    ? question.options.filter(
        (option): option is { value: string; label: string } =>
          typeof option === "object" &&
          option !== null &&
          typeof (option as { value?: unknown }).value === "string" &&
          typeof (option as { label?: unknown }).label === "string",
      )
    : [];

  if (
    question.question_type === "single_choice" ||
    question.question_type === "multiple_choice" ||
    question.question_type === "multi_choice"
  ) {
    const isMultiple =
      question.question_type === "multiple_choice" ||
      question.question_type === "multi_choice";

    return (
      <div className="space-y-2">
        {choiceOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              if (!isMultiple) {
                onAnswerJsonChange({
                  value: option.value,
                  label: option.label,
                });
                onAnswerTextChange(option.label);
                return;
              }

              const currentValues = Array.isArray(answerJson.values)
                ? answerJson.values
                : [];
              const currentLabels = Array.isArray(answerJson.labels)
                ? answerJson.labels
                : [];
              const nextValues = currentValues.includes(option.value)
                ? currentValues.filter((value) => value !== option.value)
                : [...currentValues, option.value];
              const nextLabels = currentLabels.includes(option.label)
                ? currentLabels.filter((label) => label !== option.label)
                : [...currentLabels, option.label];

              onAnswerJsonChange({
                values: nextValues,
                labels: nextLabels,
              });
              onAnswerTextChange(nextLabels.join("、"));
            }}
            className={[
              "w-full rounded-md border px-4 py-3 text-left text-sm",
              answerJson.value === option.value ||
              (Array.isArray(answerJson.values) &&
                answerJson.values.includes(option.value))
                ? "border-black bg-gray-50"
                : "",
            ].join(" ")}
          >
            {option.label}
          </button>
        ))}
      </div>
    );
  }

  if (question.question_type === "price_range") {
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        <input
          type="number"
          placeholder="下限"
          className="rounded-md border px-3 py-2"
          onChange={(event) => {
            const value = event.target.value;
            onAnswerJsonChange({
              ...answerJson,
              min: value === "" ? undefined : Number(value),
            });
          }}
        />
        <input
          type="number"
          placeholder="上限"
          className="rounded-md border px-3 py-2"
          onChange={(event) => {
            const value = event.target.value;
            onAnswerJsonChange({
              ...answerJson,
              max: value === "" ? undefined : Number(value),
            });
          }}
        />
        <select
          className="rounded-md border px-3 py-2"
          value={String(answerJson.currency ?? "JPY")}
          onChange={(event) => {
            onAnswerJsonChange({
              ...answerJson,
              currency: event.target.value,
            });
          }}
        >
          <option value="JPY">JPY</option>
          <option value="USD">USD</option>
          <option value="OTHER">OTHER</option>
        </select>
      </div>
    );
  }

  if (question.question_type === "yes_no") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => {
            onAnswerJsonChange({
              value: "yes",
              label: "はい",
            });
            onAnswerTextChange("はい");
          }}
          className="rounded-md border px-4 py-3 text-sm"
        >
          はい
        </button>

        <button
          type="button"
          onClick={() => {
            onAnswerJsonChange({
              value: "no",
              label: "いいえ",
            });
            onAnswerTextChange("いいえ");
          }}
          className="rounded-md border px-4 py-3 text-sm"
        >
          いいえ
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        {[
          "まだ決めていない",
          "候補を提案してほしい",
          "あとで考える",
        ].map((label) => (
          <button
            key={label}
            type="button"
            onClick={() => {
              onAnswerTextChange(label);
              onAnswerJsonChange({ text: label, assistedChoice: true });
            }}
            className={[
              "rounded-md border px-3 py-2 text-left text-sm",
              answerText === label ? "border-black bg-gray-50" : "",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>
      <textarea
        value={answerText}
        onChange={(event) => {
          onAnswerTextChange(event.target.value);
          onAnswerJsonChange({
            text: event.target.value,
          });
        }}
        rows={5}
        placeholder="必要なら補足を書いてください"
        className="w-full rounded-md border px-3 py-2"
      />
    </div>
  );
}

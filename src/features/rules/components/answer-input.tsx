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
  if (question.question_type === "single_choice") {
    const options = Array.isArray(question.options) ? question.options : [];

    return (
      <div className="space-y-2">
        {options.map((option: { value: string; label: string }) => (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              onAnswerJsonChange({
                value: option.value,
                label: option.label,
              });
              onAnswerTextChange(option.label);
            }}
            className={[
              "w-full rounded-md border px-4 py-3 text-left text-sm",
              answerJson.value === option.value
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
            onAnswerJsonChange({
              ...answerJson,
              min: Number(event.target.value),
            });
          }}
        />
        <input
          type="number"
          placeholder="上限"
          className="rounded-md border px-3 py-2"
          onChange={(event) => {
            onAnswerJsonChange({
              ...answerJson,
              max: Number(event.target.value),
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
    <textarea
      value={answerText}
      onChange={(event) => {
        onAnswerTextChange(event.target.value);
        onAnswerJsonChange({
          text: event.target.value,
        });
      }}
      rows={5}
      placeholder="ここに回答を書いてください"
      className="w-full rounded-md border px-3 py-2"
    />
  );
}

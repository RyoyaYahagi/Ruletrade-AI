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

  if (question.question_type === "percent_slider") {
    const config = isPercentSliderOptions(question.options)
      ? question.options
      : { min: 0, max: 100, step: 1, presets: [] };
    const selectedValue =
      typeof answerJson.value === "number" || answerJson.value === null
        ? answerJson.value
        : config.presets[0]?.value ?? config.min;

    return (
      <div className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-3">
          {config.presets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                onAnswerJsonChange({ value: preset.value });
                onAnswerTextChange(preset.label);
              }}
              className={[
                "rounded-md border px-4 py-3 text-sm",
                selectedValue === preset.value
                  ? "border-black bg-gray-50"
                  : "",
              ].join(" ")}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <details>
          <summary className="cursor-pointer text-sm text-muted-foreground">
            数値を細かく調整する
          </summary>
          <div className="mt-3 flex items-center gap-3">
            <input
              type="range"
              min={config.min}
              max={config.max}
              step={config.step}
              value={
                typeof selectedValue === "number" ? selectedValue : config.min
              }
              onChange={(event) => {
                const value = Number(event.target.value);
                onAnswerJsonChange({ value });
                onAnswerTextChange(`${value}%`);
              }}
              className="w-full"
            />
            <span className="min-w-12 text-right text-sm">
              {selectedValue == null ? "未設定" : `${selectedValue}%`}
            </span>
          </div>
        </details>
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

function isPercentSliderOptions(
  options: unknown,
): options is {
  min: number;
  max: number;
  step: number;
  presets: Array<{ label: string; value: number | null }>;
} {
  if (typeof options !== "object" || options === null) return false;
  const value = options as Record<string, unknown>;
  return (
    typeof value.min === "number" &&
    typeof value.max === "number" &&
    typeof value.step === "number" &&
    Array.isArray(value.presets) &&
    value.presets.every(
      (preset) =>
        typeof preset === "object" &&
        preset !== null &&
        typeof (preset as { label?: unknown }).label === "string" &&
        (typeof (preset as { value?: unknown }).value === "number" ||
          (preset as { value?: unknown }).value === null),
    )
  );
}

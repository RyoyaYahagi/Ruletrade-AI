"use client";

import { japanDate } from "@/features/transactions/matching";

export type ReviewScheduleValue = {
  choices: string[];
  earningsDate: string;
  dates: string[];
};

export function ReviewSchedule({
  value,
  onChange,
}: {
  value: ReviewScheduleValue;
  onChange: (value: ReviewScheduleValue) => void;
}) {
  function toggle(choice: string) {
    onChange({
      ...value,
      choices:
        choice === "none"
          ? []
          : value.choices.includes(choice)
            ? value.choices.filter((item) => item !== choice)
            : [...value.choices, choice],
    });
  }
  return (
    <fieldset className="rounded-xl border p-4">
      <legend className="px-1 text-sm font-semibold">
        振り返る時期（任意）
      </legend>
      <p className="mb-3 text-xs text-muted-foreground">
        複数選択できます。日付も追加できます。
      </p>
      <div className="flex flex-wrap gap-2">
        {[
          ["none", "設定しない"],
          ["month", "1か月後"],
          ["quarter", "3か月後"],
          ["earnings", "次の決算"],
          ["date", "日付指定"],
        ].map(([choice, label]) => {
          const selected =
            choice === "none"
              ? value.choices.length === 0
              : value.choices.includes(choice);
          return (
            <button
              type="button"
              key={choice}
              aria-pressed={selected}
              onClick={() => toggle(choice)}
              className={`rounded-full border px-3 py-1.5 text-sm ${selected ? "border-primary bg-primary text-primary-foreground" : "bg-background"}`}
            >
              {label}
            </button>
          );
        })}
      </div>
      {value.choices.includes("earnings") && (
        <label className="mt-3 block max-w-xs text-sm">
          次の決算日
          <input
            type="date"
            value={value.earningsDate}
            onChange={(event) =>
              onChange({ ...value, earningsDate: event.target.value })
            }
            className="mt-1 w-full rounded-lg border bg-background px-3 py-2"
          />
        </label>
      )}
      {value.choices.includes("date") && (
        <div className="mt-3 space-y-3">
          {value.dates.map((date, index) => (
            <div key={index} className="flex items-end gap-2">
              <label className="block max-w-xs text-sm">
                {index === 0 ? "振り返り日" : `追加の振り返り日 ${index}`}
                <input
                  type="date"
                  value={date}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      dates: value.dates.map((item, i) =>
                        i === index ? event.target.value : item,
                      ),
                    })
                  }
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2"
                />
              </label>
              {index > 0 && (
                <button
                  type="button"
                  aria-label={`追加の振り返り日 ${index}を削除`}
                  onClick={() =>
                    onChange({
                      ...value,
                      dates: value.dates.filter((_, i) => i !== index),
                    })
                  }
                  className="rounded-lg border px-3 py-2 text-sm"
                >
                  削除
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => onChange({ ...value, dates: [...value.dates, ""] })}
            className="rounded-lg border px-3 py-2 text-sm"
          >
            振り返り日を追加
          </button>
        </div>
      )}
    </fieldset>
  );
}

export function resolveReviewDates(
  schedule: ReviewScheduleValue,
  originalDates: string[] = [],
): string[] {
  return schedule.choices.flatMap((choice) => {
    if (choice === "month" || choice === "quarter") {
      return [
        new Date(
          Date.now() + (choice === "month" ? 30 : 90) * 86400000,
        ).toISOString(),
      ];
    }
    return (
      choice === "earnings" ? [schedule.earningsDate] : schedule.dates
    ).map(
      (date) =>
        originalDates.find((original) => japanDate(original) === date) ??
        new Date(`${date}T12:00:00.000Z`).toISOString(),
    );
  });
}

"use client";

import { useEffect, useState } from "react";

export function AccessibilitySettingsForm() {
  const [preferences, setPreferences] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const response = await fetch("/api/ui/preferences");
      const json = await response.json();
      if (json.ok) setPreferences(json.data.preferences);
    }
    void load();
  }, []);

  async function update(next: Record<string, unknown>) {
    const response = await fetch("/api/ui/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    const json = await response.json();
    if (json.ok) {
      setPreferences(json.data.preferences);
      setMessage("設定を保存しました。");
    }
  }

  if (!preferences) {
    return <p className="text-sm text-muted-foreground">設定を読み込み中...</p>;
  }

  return (
    <section className="rounded-lg border p-6" data-testid="accessibility-settings-form">
      <h2 className="text-lg font-semibold">Accessibility</h2>
      <div className="mt-4 space-y-4">
        <label className="flex items-center justify-between gap-4">
          <span>
            <span className="block text-sm font-medium">Reduced motion</span>
            <span className="block text-sm text-muted-foreground">
              画面のアニメーションを減らします。
            </span>
          </span>
          <input
            type="checkbox"
            data-testid="accessibility-checkbox-reduced-motion"
            checked={Boolean(preferences.reduced_motion)}
            onChange={(event) =>
              void update({ reducedMotion: event.target.checked })
            }
          />
        </label>
        <label className="flex items-center justify-between gap-4">
          <span>
            <span className="block text-sm font-medium">High contrast</span>
            <span className="block text-sm text-muted-foreground">
              フォーカスや境界線を見やすくします。
            </span>
          </span>
          <input
            type="checkbox"
            data-testid="accessibility-checkbox-high-contrast"
            checked={Boolean(preferences.high_contrast)}
            onChange={(event) =>
              void update({ highContrast: event.target.checked })
            }
          />
        </label>
        <label className="flex items-center justify-between gap-4">
          <span>
            <span className="block text-sm font-medium">Larger text</span>
            <span className="block text-sm text-muted-foreground">
              文字を少し大きく表示します。
            </span>
          </span>
          <input
            type="checkbox"
            data-testid="accessibility-checkbox-larger-text"
            checked={Boolean(preferences.larger_text)}
            onChange={(event) =>
              void update({ largerText: event.target.checked })
            }
          />
        </label>
      </div>
      {message ? (
        <p role="status" className="mt-4 text-sm text-green-700" data-testid="accessibility-message">
          {message}
        </p>
      ) : null}
    </section>
  );
}

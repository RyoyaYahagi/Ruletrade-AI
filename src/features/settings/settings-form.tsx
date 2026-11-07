"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { saveAppSettingsAction } from "@/features/settings/actions";
import type { AppSettings } from "@/schemas/app-settings";

function inputValue(value: number | null): string {
  return value === null ? "" : String(value);
}

function parseValue(value: string): number | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : Number(trimmed);
}

export function BucketSettingsForm({ settings }: { settings: AppSettings }) {
  const router = useRouter();
  const [cap, setCap] = useState(inputValue(settings.satelliteCapPct));
  const [warn, setWarn] = useState(inputValue(settings.satelliteWarnPct));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function save(
    capValue: number | null,
    warnValue: number | null,
  ): Promise<void> {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const saved = await saveAppSettingsAction({
        satelliteCapPct: capValue,
        satelliteWarnPct: warnValue,
      });
      setCap(inputValue(saved.satelliteCapPct));
      setWarn(inputValue(saved.satelliteWarnPct));
      setMessage("枠の設定を保存しました。");
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "枠の設定を保存できませんでした。",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void save(parseValue(cap), parseValue(warn));
      }}
      className="surface space-y-4 p-5"
    >
      <div>
        <h3 className="font-semibold">コア／サテライトの枠</h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          上限は投入額ベース、警告線は時価ベースのサテライト割合です。空欄にすると未設定になり、割合の表示だけを行います。数値はここで決めて保存してください。
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-muted-foreground">
          サテライト上限（投入額ベース・％）
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={cap}
            onChange={(event) => setCap(event.target.value)}
            placeholder="未設定"
            className="input mt-1 text-foreground"
          />
        </label>
        <label className="text-sm text-muted-foreground">
          警告線（時価ベース・％）
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={warn}
            onChange={(event) => setWarn(event.target.value)}
            placeholder="未設定"
            className="input mt-1 text-foreground"
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={saving} className="button-soft">
          {saving ? "保存しています…" : "枠の設定を保存"}
        </button>
        <button
          type="button"
          disabled={saving || (cap === "" && warn === "")}
          onClick={() => void save(null, null)}
          className="button-outline"
        >
          両方とも未設定に戻す
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm text-primary">
          {message}
        </p>
      )}
    </form>
  );
}

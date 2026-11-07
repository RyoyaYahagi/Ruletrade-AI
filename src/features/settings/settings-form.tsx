"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  satelliteRemainingJpy,
  type BucketSummary,
} from "@/features/portfolio/bucket-summary";
import { formatPortfolioAmount } from "@/features/portfolio/format";
import { saveAppSettingsAction } from "@/features/settings/actions";
import type { AppSettings } from "@/schemas/app-settings";

/** フォームのその場の予測に使う、いまの集計値。算出できないときの値は null */
export type BucketSettingsCurrent = Pick<
  BucketSummary,
  | "totalInvestedJpy"
  | "satelliteInvestedJpy"
  | "satelliteInvestedPct"
  | "satelliteMarketValuePct"
  | "coreRegistered"
>;

function inputValue(value: number | null): string {
  return value === null ? "" : String(value);
}

function parseValue(value: string): number | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : Number(trimmed);
}

function isValidPercent(value: number | null): boolean {
  return (
    value === null || (Number.isFinite(value) && value >= 0 && value <= 100)
  );
}

function formatPercent(value: number): string {
  return `${value.toLocaleString("ja-JP", { maximumFractionDigits: 1 })}%`;
}

function formatYen(value: number): string {
  return formatPortfolioAmount(value, "JPY");
}

const OUT_OF_RANGE = "0〜100 の数値で入力してください。";

function CapPreview({
  value,
  current,
}: {
  value: number | null;
  current: BucketSettingsCurrent;
}) {
  if (!isValidPercent(value))
    return <p className="text-xs text-destructive">{OUT_OF_RANGE}</p>;
  if (value === null)
    return (
      <p className="text-xs text-muted-foreground">
        未設定：残り枠は出しません。
      </p>
    );
  if (!current.coreRegistered)
    return (
      <p className="text-xs text-muted-foreground">
        コアに区分した銘柄がないため、残り枠は出しません。
      </p>
    );
  const cap = satelliteRemainingJpy(current, value);
  if (cap === null || current.satelliteInvestedPct === null)
    return (
      <p className="text-xs text-muted-foreground">
        いまの投入額割合を算出できないため、残り枠は出せません。
      </p>
    );
  return cap.remainingJpy >= 0 ? (
    <p className="text-xs text-muted-foreground">
      この上限だと、サテライトに足せる残りは{" "}
      <span className="font-mono font-semibold text-foreground">
        {formatYen(cap.remainingJpy)}
      </span>
      （いま {formatPercent(current.satelliteInvestedPct)}）
    </p>
  ) : (
    <p className="text-xs text-attention">
      この上限を {formatYen(-cap.remainingJpy)} 超えた状態になります（いま{" "}
      {formatPercent(current.satelliteInvestedPct)}）
    </p>
  );
}

function WarnPreview({
  value,
  current,
}: {
  value: number | null;
  current: BucketSettingsCurrent;
}) {
  if (!isValidPercent(value))
    return <p className="text-xs text-destructive">{OUT_OF_RANGE}</p>;
  if (value === null)
    return (
      <p className="text-xs text-muted-foreground">
        未設定：警告は出しません。
      </p>
    );
  const marketPct = current.satelliteMarketValuePct;
  if (marketPct === null)
    return (
      <p className="text-xs text-muted-foreground">
        いまの時価割合を算出できません。
      </p>
    );
  // 判定は evaluateBucketWarning と同じく「警告線より大きい」ときだけ超過とする
  return marketPct > value ? (
    <p className="text-xs text-attention">
      いまの時価割合 {formatPercent(marketPct)}{" "}
      はこの線を超えています。保存すると今日画面に警告が出ます。
    </p>
  ) : (
    <p className="text-xs text-muted-foreground">
      いまの時価割合 {formatPercent(marketPct)} はこの線以下です。
    </p>
  );
}

export function BucketSettingsForm({
  settings,
  current,
}: {
  settings: AppSettings;
  current: BucketSettingsCurrent;
}) {
  const router = useRouter();
  const [cap, setCap] = useState(inputValue(settings.satelliteCapPct));
  const [warn, setWarn] = useState(inputValue(settings.satelliteWarnPct));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const capValue = parseValue(cap);
  const warnValue = parseValue(warn);
  const unset =
    settings.satelliteCapPct === null && settings.satelliteWarnPct === null;

  async function save(
    nextCap: number | null,
    nextWarn: number | null,
  ): Promise<void> {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const saved = await saveAppSettingsAction({
        satelliteCapPct: nextCap,
        satelliteWarnPct: nextWarn,
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
        void save(capValue, warnValue);
      }}
      className="surface space-y-5 p-5"
    >
      <div className="space-y-2">
        <h3 className="font-semibold">コア／サテライトの枠</h3>
        <div className="flex flex-wrap gap-2">
          <span className="chip">
            いまの投入額割合{" "}
            {current.satelliteInvestedPct === null
              ? "—"
              : formatPercent(current.satelliteInvestedPct)}
          </span>
          <span className="chip">
            いまの時価割合{" "}
            {current.satelliteMarketValuePct === null
              ? "—"
              : formatPercent(current.satelliteMarketValuePct)}
          </span>
        </div>
        {unset && (
          <p className="text-xs leading-5 text-muted-foreground">
            いまは未設定です。割合の表示だけを行い、残り枠と警告は出しません。
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="satellite-cap" className="block text-sm font-medium">
          サテライトの上限
        </label>
        <p id="satellite-cap-basis" className="text-xs text-muted-foreground">
          投入額（買付金額の合計）に対する割合
        </p>
        <div className="flex items-center gap-2">
          <input
            id="satellite-cap"
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={cap}
            onChange={(event) => setCap(event.target.value)}
            placeholder="未設定"
            aria-describedby="satellite-cap-basis satellite-cap-preview"
            className="input max-w-32 text-foreground"
          />
          <span className="text-sm text-muted-foreground">%</span>
        </div>
        <div id="satellite-cap-preview" aria-live="polite">
          <CapPreview value={capValue} current={current} />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="satellite-warn" className="block text-sm font-medium">
          警告線
        </label>
        <p id="satellite-warn-basis" className="text-xs text-muted-foreground">
          時価（評価額の合計）に対する割合
        </p>
        <div className="flex items-center gap-2">
          <input
            id="satellite-warn"
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={warn}
            onChange={(event) => setWarn(event.target.value)}
            placeholder="未設定"
            aria-describedby="satellite-warn-basis satellite-warn-preview"
            className="input max-w-32 text-foreground"
          />
          <span className="text-sm text-muted-foreground">%</span>
        </div>
        <div id="satellite-warn-preview" aria-live="polite">
          <WarnPreview value={warnValue} current={current} />
        </div>
      </div>

      <p className="text-xs leading-5 text-muted-foreground">
        上限と警告線は計算の元が違うため、同じ数値でも判定が変わることがあります。
      </p>

      <div className="space-y-1 text-center">
        <button type="submit" disabled={saving} className="button-soft w-full">
          {saving ? "保存しています…" : "枠の設定を保存"}
        </button>
        <button
          type="button"
          disabled={saving || (cap === "" && warn === "")}
          onClick={() => void save(null, null)}
          className="min-h-11 px-2 text-sm text-muted-foreground underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
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

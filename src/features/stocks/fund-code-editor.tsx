"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { setStockFundCodesAction } from "@/features/stocks/actions";

export function FundCodeEditor({
  stockId,
  fundIsin,
  fundAssociationCode,
}: {
  stockId: string;
  fundIsin: string | null;
  fundAssociationCode: string | null;
}) {
  const router = useRouter();
  const [isin, setIsin] = useState(fundIsin ?? "");
  const [code, setCode] = useState(fundAssociationCode ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const result = await setStockFundCodesAction({
        stockId,
        fundIsin: isin,
        fundAssociationCode: code,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setIsin(result.fundIsin ?? "");
      setCode(result.fundAssociationCode ?? "");
      setMessage(
        result.fundIsin
          ? "コードを保存しました。基準価額は投資信託協会から取得します。"
          : "コードを消しました。",
      );
      router.refresh();
    } catch {
      setError(
        "コードを保存できませんでした。時間をおいて再度お試しください。",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <details className="surface px-5 text-sm" open={!fundIsin}>
      <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-2 font-semibold">
        基準価額の取得
        <span className="text-xs font-normal text-muted-foreground">
          {fundIsin ? `${fundIsin} / ${fundAssociationCode}` : "未設定"}
        </span>
      </summary>
      <form onSubmit={(event) => void submit(event)} className="space-y-3 pb-5">
        <p className="text-xs leading-5 text-muted-foreground">
          投資信託は銘柄コードで価格を引けないため、ISINコードと協会コードで投資信託協会の基準価額を取得します。両方とも投資信託協会の投信総合検索ライブラリーのファンド詳細に載っています。
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm text-muted-foreground">
            ISINコード
            <input
              value={isin}
              onChange={(event) => setIsin(event.target.value)}
              placeholder="例: JP90C000GKC6"
              autoCapitalize="characters"
              className="input mt-1 font-mono text-foreground"
            />
          </label>
          <label className="block text-sm text-muted-foreground">
            協会コード
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="例: 03311187"
              autoCapitalize="characters"
              className="input mt-1 font-mono text-foreground"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="button-soft w-full sm:w-auto"
        >
          {saving ? "保存しています…" : "コードを保存"}
        </button>
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
    </details>
  );
}

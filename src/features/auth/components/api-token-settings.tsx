"use client";

import { useEffect, useState } from "react";

type TokenMeta = {
  id: string;
  label: string;
  scopes: string;
  last_used_at?: string | null;
  expires_at?: string | null;
  revoked_at?: string | null;
  created_at: string;
};

export function ApiTokenSettings() {
  const [tokens, setTokens] = useState<TokenMeta[]>([]);
  const [label, setLabel] = useState("");
  const [scopes, setScopes] = useState<"read" | "read,write">("read");
  const [expiresInDays, setExpiresInDays] = useState("");
  const [newToken, setNewToken] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function loadTokens() {
    const response = await fetch("/api/settings/api-tokens");
    const json = await response.json();
    if (response.ok && json.ok) setTokens(json.data.tokens ?? []);
  }

  useEffect(() => {
    let active = true;
    void fetch("/api/settings/api-tokens")
      .then((response) => response.json())
      .then((json) => {
        if (active && json.ok) setTokens(json.data.tokens ?? []);
      });
    return () => {
      active = false;
    };
  }, []);

  async function issueToken(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setErrorMessage(null);
    setNewToken(null);

    const response = await fetch("/api/settings/api-tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label,
        scopes,
        expiresInDays: expiresInDays ? Number(expiresInDays) : undefined,
      }),
    });
    const json = await response.json();
    if (!response.ok || !json.ok) {
      setErrorMessage(json.error?.message ?? "APIトークンを発行できませんでした。");
      return;
    }
    setNewToken(json.data.token);
    setLabel("");
    setExpiresInDays("");
    setMessage("APIトークンを発行しました。平文はこの画面でのみ確認できます。");
    await loadTokens();
  }

  async function revokeToken(tokenId: string) {
    if (!window.confirm("このAPIトークンを失効しますか？")) return;
    const response = await fetch(`/api/settings/api-tokens/${tokenId}`, { method: "DELETE" });
    const json = await response.json();
    if (!response.ok || !json.ok) {
      setErrorMessage(json.error?.message ?? "APIトークンを失効できませんでした。");
      return;
    }
    await loadTokens();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={issueToken} className="space-y-4 rounded-lg border p-6">
        <div>
          <label htmlFor="api-token-label" className="text-sm font-medium">ラベル</label>
          <input id="api-token-label" value={label} onChange={(event) => setLabel(event.target.value)} required maxLength={80} className="mt-1 w-full rounded-md border px-3 py-2" placeholder="Claude Code" />
        </div>
        <div>
          <label htmlFor="api-token-scope" className="text-sm font-medium">スコープ</label>
          <select id="api-token-scope" value={scopes} onChange={(event) => setScopes(event.target.value as typeof scopes)} className="mt-1 w-full rounded-md border px-3 py-2">
            <option value="read">read（閲覧のみ）</option>
            <option value="read,write">read,write（下書き入力まで）</option>
          </select>
          <p className="mt-1 text-xs text-muted-foreground">承認・通知への応答・削除・予算変更は、どちらのスコープでもAPIから実行できません。</p>
        </div>
        <div>
          <label htmlFor="api-token-expiry" className="text-sm font-medium">有効期限（日、任意）</label>
          <input id="api-token-expiry" type="number" min={1} max={3650} value={expiresInDays} onChange={(event) => setExpiresInDays(event.target.value)} className="mt-1 w-full rounded-md border px-3 py-2" />
        </div>
        <button type="submit" className="rounded-md bg-black px-4 py-2 text-sm text-white">発行する</button>
      </form>

      {newToken ? (
        <section className="rounded-lg border border-amber-300 bg-amber-50 p-6">
          <h2 className="font-semibold">発行直後のトークン</h2>
          <p className="mt-2 text-sm">この画面を閉じると再表示できません。安全な場所へ保存してください。</p>
          <code className="mt-3 block break-all rounded bg-white p-3 text-sm">{newToken}</code>
          <button type="button" className="mt-3 rounded-md border px-3 py-2 text-sm" onClick={() => void navigator.clipboard.writeText(newToken)}>コピー</button>
        </section>
      ) : null}

      {message ? <p className="rounded-md bg-green-50 p-3 text-sm text-green-700">{message}</p> : null}
      {errorMessage ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{errorMessage}</p> : null}

      <section className="rounded-lg border p-6">
        <h2 className="font-semibold">発行済みトークン</h2>
        <div className="mt-4 space-y-3">
          {tokens.length === 0 ? <p className="text-sm text-muted-foreground">発行済みのトークンはありません。</p> : null}
          {tokens.map((token) => (
            <div key={token.id} className="flex items-center justify-between gap-4 rounded-md border p-3 text-sm">
              <div>
                <p className="font-medium">{token.label}（{token.scopes}）</p>
                <p className="text-xs text-muted-foreground">最終利用: {token.last_used_at ?? "未使用"}{token.expires_at ? ` / 期限: ${token.expires_at}` : " / 無期限"}</p>
              </div>
              {token.revoked_at ? <span className="text-xs text-muted-foreground">失効済み</span> : <button type="button" className="rounded-md border px-3 py-1 text-xs" onClick={() => void revokeToken(token.id)}>失効</button>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

type ProviderKey = "mock" | "openai" | "gemini" | "codex-app-server";

type ProviderOption = {
  key: ProviderKey;
  label: string;
  models: string[];
};

type AccountStatus = {
  authenticated: boolean;
  authMode: string | null;
  planType: string | null;
};

type LoginInfo = {
  mode: "browser";
  loginId: string;
  authUrl: string;
};

export function DeveloperAiSettingsForm() {
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [provider, setProvider] = useState<ProviderKey>("mock");
  const [model, setModel] = useState("mock-model");
  const [account, setAccount] = useState<AccountStatus | null>(null);
  const [login, setLogin] = useState<LoginInfo | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/ai/developer-settings");
        const json = await response.json();
        if (!json.ok) {
          setError(json.error?.message ?? "AI設定を読み込めませんでした。");
          return;
        }

        setProviders(json.data.providers);
        setProvider(json.data.settings.provider);
        setModel(json.data.settings.model);
      } catch {
        setError("AI設定を読み込めませんでした。");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  async function refreshCodexAccount() {
    try {
      const response = await fetch("/api/ai/codex/account");
      const json = await response.json();
      if (json.ok) {
        setAccount(json.data);
        return json.data as AccountStatus;
      }
      setAccount(null);
      return null;
    } catch {
      setAccount(null);
      return null;
    }
  }

  async function startCodexLogin() {
    setLoggingIn(true);
    setError(null);
    try {
      const response = await fetch("/api/ai/codex/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "browser" }),
      });
      const json = await response.json();
      if (!json.ok) {
        setError(json.error?.message ?? "ChatGPTログインを開始できませんでした。");
        return;
      }

      setLogin(json.data);
      setMessage("ChatGPTログインURLを発行しました。ログイン完了後に状態を更新してください。");
    } catch {
      setError("ChatGPTログインを開始できませんでした。");
    } finally {
      setLoggingIn(false);
    }
  }

  async function handleProviderChange(nextProvider: ProviderKey) {
    setProvider(nextProvider);
    setLogin(null);
    setMessage(null);
    const selected = providers.find((option) => option.key === nextProvider);
    if (selected?.models[0]) setModel(selected.models[0]);

    if (nextProvider === "codex-app-server") {
      const status = await refreshCodexAccount();
      if (!status?.authenticated) void startCodexLogin();
    } else {
      setAccount(null);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/ai/developer-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, model }),
      });
      const json = await response.json();
      if (!json.ok) {
        setError(json.error?.message ?? "AI設定を保存できませんでした。");
        return;
      }
      setMessage("AI設定を保存しました。");
    } catch {
      setError("AI設定を保存できませんでした。");
    } finally {
      setSaving(false);
    }
  }

  const selectedProvider = providers.find((option) => option.key === provider);
  const models = selectedProvider?.models ?? [model];

  if (loading) {
    return <p className="text-sm text-muted-foreground">AI設定を読み込み中...</p>;
  }

  return (
    <section className="rounded-lg border p-6" data-testid="developer-ai-settings-form">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">AI Provider / Model</h2>
        <p className="text-sm text-muted-foreground">
          開発環境でのみ利用できます。設定はユーザー単位で保存されます。
        </p>
      </div>

      <div className="mt-6 space-y-4">
        <label className="block space-y-2">
          <span className="text-sm font-medium">使用するAI Provider</span>
          <select
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            data-testid="developer-ai-provider"
            value={provider}
            onChange={(event) =>
              void handleProviderChange(event.target.value as ProviderKey)
            }
          >
            {providers.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium">使用するモデル</span>
          <select
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            data-testid="developer-ai-model"
            value={model}
            onChange={(event) => setModel(event.target.value)}
          >
            {!models.includes(model) ? <option value={model}>{model}</option> : null}
            {models.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        {provider === "codex-app-server" ? (
          <div className="rounded-md border bg-muted/30 p-4 text-sm" data-testid="codex-login-panel">
            <p className="font-medium">ChatGPTアカウント</p>
            <p className="mt-1 text-muted-foreground">
              {account?.authenticated
                ? `ログイン済み${account.planType ? `（${account.planType}）` : ""}`
                : "ログインが必要です。"}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {!account?.authenticated ? (
                <button
                  type="button"
                  className="rounded-md border px-3 py-2 text-sm"
                  data-testid="codex-login-button"
                  disabled={loggingIn}
                  onClick={() => void startCodexLogin()}
                >
                  {loggingIn ? "ログインURLを発行中..." : "ChatGPTにログイン"}
                </button>
              ) : null}
              <button
                type="button"
                className="rounded-md border px-3 py-2 text-sm"
                onClick={() => void refreshCodexAccount()}
              >
                ログイン状態を更新
              </button>
            </div>
            {login ? (
              <a
                className="mt-3 inline-block text-sm underline"
                href={login.authUrl}
                target="_blank"
                rel="noreferrer"
              >
                ChatGPTログイン画面を開く
              </a>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <p className="text-sm text-red-700" role="alert" data-testid="developer-ai-error">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="text-sm text-green-700" role="status" data-testid="developer-ai-message">
            {message}
          </p>
        ) : null}

        <button
          type="button"
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
          data-testid="developer-ai-save"
          disabled={saving || (provider === "codex-app-server" && !account?.authenticated)}
          onClick={() => void save()}
        >
          {saving ? "保存中..." : "AI設定を保存"}
        </button>
      </div>
    </section>
  );
}

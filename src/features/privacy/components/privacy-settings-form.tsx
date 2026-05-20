"use client";

import { useEffect, useState } from "react";

export function PrivacySettingsForm() {
  const [settings, setSettings] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/privacy/settings");
      const json = await res.json();
      if (json.ok && json.data.settings) {
        setSettings({
          aiMemoryEnabled: json.data.settings.ai_memory_enabled,
          aiLoggingEnabled: json.data.settings.ai_logging_enabled,
          aiPayloadLoggingEnabled:
            json.data.settings.ai_payload_logging_enabled,
          allowRagIndexing: json.data.settings.allow_rag_indexing,
          allowDocumentIndexing: json.data.settings.allow_document_indexing,
        });
      }
    }
    void load();
  }, []);

  async function toggle(key: string) {
    setSaving(true);
    setMessage(null);
    const updated = { ...settings, [key]: !settings[key] };
    try {
      const res = await fetch("/api/privacy/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: updated[key] }),
      });
      const json = await res.json();
      if (json.ok) {
        setSettings(updated);
        setMessage("設定を更新しました。");
      } else {
        setMessage(json.error?.message ?? "更新に失敗しました。");
      }
    } catch {
      setMessage("通信に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  const items = [
    {
      key: "aiMemoryEnabled",
      label: "AIメモリを許可",
      desc: "過去のルールやメモをAIが参照できるようにする",
    },
    {
      key: "allowRagIndexing",
      label: "RAGインデックスを許可",
      desc: "ルールやメモをRAG检索用にインデックス化する",
    },
    {
      key: "allowDocumentIndexing",
      label: "資料インデックスを許可",
      desc: "アップロード資料をRAG检索用にインデックス化する",
    },
    {
      key: "aiLoggingEnabled",
      label: "AIログを許可",
      desc: "AI実行ログを保存する",
    },
    {
      key: "aiPayloadLoggingEnabled",
      label: "AI入出力ログを許可",
      desc: "AIの入力/出力内容をログに含める（詳細）",
    },
  ];

  return (
    <section className="rounded-lg border p-6">
      <h2 className="text-lg font-semibold">Privacy 設定</h2>
      {message ? (
        <p className="mt-2 text-sm text-green-700">{message}</p>
      ) : null}
      <div className="mt-4 space-y-4">
        {items.map((item) => (
          <div key={item.key} className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
            <button
              type="button"
              onClick={() => void toggle(item.key)}
              disabled={saving}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings[item.key] ? "bg-black" : "bg-gray-200"}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings[item.key] ? "translate-x-6" : "translate-x-1"}`}
              />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

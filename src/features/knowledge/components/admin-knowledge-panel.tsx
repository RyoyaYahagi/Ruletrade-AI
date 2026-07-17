"use client";

import { useEffect, useState } from "react";

type Article = {
  id: string;
  title: string;
  authorName: string;
  licenseNote: string;
  isActive: boolean;
};

export function AdminKnowledgePanel() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    body: "",
    topicKeys: "",
    authorName: "",
    sourceName: "",
    sourceUrl: "",
    licenseNote: "",
    publishedAt: "",
  });

  async function loadArticles() {
    const response = await fetch("/api/admin/knowledge");
    const json = await response.json();
    if (response.ok && json.ok) setArticles(json.data.articles ?? []);
  }

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/admin/knowledge")
      .then((response) => (response.ok ? response.json() : null))
      .then((json: { data?: { articles?: Article[] } } | null) => {
        if (!cancelled) setArticles(json?.data?.articles ?? []);
      })
      .catch(() => {
        if (!cancelled) setArticles([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function createArticle(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    if (!form.licenseNote.trim()) {
      setMessage("権利処理の記録（license_note）は必須です。");
      return;
    }
    const response = await fetch("/api/admin/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        topicKeys: form.topicKeys.split(",").map((key) => key.trim()).filter(Boolean),
        sourceName: form.sourceName || null,
        sourceUrl: form.sourceUrl || null,
        publishedAt: form.publishedAt || null,
        isActive: true,
      }),
    });
    const json = await response.json();
    if (!response.ok || !json.ok) {
      setMessage(json.error?.message ?? "保存に失敗しました。");
      return;
    }
    setForm({ title: "", body: "", topicKeys: "", authorName: "", sourceName: "", sourceUrl: "", licenseNote: "", publishedAt: "" });
    setMessage("保存しました。");
    await loadArticles();
  }

  async function deactivate(articleId: string) {
    await fetch(`/api/admin/knowledge/${encodeURIComponent(articleId)}`, { method: "DELETE" });
    await loadArticles();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={(event) => void createArticle(event)} className="space-y-3 rounded border p-4">
        <h2 className="font-semibold">解説記事を登録</h2>
        <p className="text-sm text-muted-foreground">権利処理の記録がない記事は保存できません。topic keyはカンマ区切りで入力します。</p>
        {Object.entries(form).map(([key, value]) => (
          key === "body" ? (
            <textarea key={key} aria-label={key} value={value} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} className="min-h-32 w-full rounded border p-2" placeholder={key} required={!isOptionalField(key)} />
          ) : (
            <input key={key} aria-label={key} value={value} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} className="w-full rounded border p-2" placeholder={key} required={!isOptionalField(key)} />
          )
        ))}
        <button type="submit" className="rounded bg-black px-4 py-2 text-sm text-white">保存</button>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </form>

      <section className="space-y-3">
        <h2 className="font-semibold">登録済み記事</h2>
        {articles.map((article) => (
          <article key={article.id} className="flex items-start justify-between gap-4 rounded border p-4">
            <div><h3 className="font-medium">{article.title}</h3><p className="text-sm text-muted-foreground">{article.authorName} / {article.licenseNote}</p></div>
            {article.isActive ? <button type="button" onClick={() => void deactivate(article.id)} className="rounded border px-3 py-1 text-sm">無効化</button> : <span className="text-sm text-muted-foreground">無効</span>}
          </article>
        ))}
      </section>
    </div>
  );
}

function isOptionalField(key: string) {
  return key === "sourceName" || key === "sourceUrl" || key === "publishedAt";
}

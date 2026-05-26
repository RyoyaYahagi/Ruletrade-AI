"use client";

import { useState } from "react";

export function SupportForm() {
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("general");
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    const response = await fetch("/api/support/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, subject, body, category }),
    });
    const json = await response.json();
    setIsSubmitting(false);
    if (!json.ok) {
      setMessage(json.error?.message ?? "送信できませんでした。");
      return;
    }
    setEmail("");
    setSubject("");
    setBody("");
    setMessage(
      "お問い合わせを受け付けました。返信までしばらくお待ちください。",
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="support-form">
      <div>
        <label className="text-sm font-medium">メールアドレス</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 block w-full rounded-md border px-3 py-2"
          data-testid="support-email-input"
        />
      </div>
      <div>
        <label className="text-sm font-medium">カテゴリ</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="mt-1 block w-full rounded-md border px-3 py-2"
          data-testid="support-category-select"
        >
          <option value="general">一般</option>
          <option value="auth">認証</option>
          <option value="ai_review">AIレビュー</option>
          <option value="document">資料</option>
          <option value="privacy">プライバシー</option>
          <option value="billing">課金</option>
          <option value="bug">不具合</option>
        </select>
      </div>
      <div>
        <label className="text-sm font-medium">件名</label>
        <input
          required
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="mt-1 block w-full rounded-md border px-3 py-2"
          data-testid="support-subject-input"
        />
      </div>
      <div>
        <label className="text-sm font-medium">内容</label>
        <textarea
          required
          rows={5}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="mt-1 block w-full rounded-md border px-3 py-2"
          data-testid="support-body-textarea"
        />
      </div>
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white"
        data-testid="support-submit-button"
      >
        {isSubmitting ? "送信中..." : "送信"}
      </button>
      {message ? (
        <p role="status" className="text-sm text-green-700" data-testid="support-message">
          {message}
        </p>
      ) : null}
    </form>
  );
}

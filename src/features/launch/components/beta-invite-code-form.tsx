"use client";

import { useState } from "react";

export function BetaInviteCodeForm() {
  const [inviteCode, setInviteCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    const response = await fetch("/api/beta/invite-codes/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteCode }),
    });
    const json = await response.json();
    setIsSubmitting(false);
    if (!json.ok) {
      setMessage(json.error?.message ?? "招待コードを確認できませんでした。");
      return;
    }
    window.location.href = "/dashboard";
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border p-4">
      <label className="text-sm font-medium">
        招待コード
        <input
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
          className="mt-1 block w-full rounded-md border px-3 py-2"
          autoComplete="one-time-code"
        />
      </label>
      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-4 rounded-md bg-black px-4 py-2 text-sm text-white"
      >
        {isSubmitting ? "確認中..." : "利用を開始"}
      </button>
      {message ? (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {message}
        </p>
      ) : null}
    </form>
  );
}

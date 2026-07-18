"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AttentionBadge } from "@/components/status/attention-badge";
import { StatValue } from "@/components/status/stat-value";
import type { TodayFeedResult } from "@/features/ux/services/today-feed-service";

export function TodayFeed() {
  const [data, setData] = useState<TodayFeedResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/today");
        const json = await response.json();
        if (!response.ok || !json.ok) {
          setErrorMessage(json.error?.message ?? "Todayの読み込みに失敗しました。");
          return;
        }
        setData(json.data as TodayFeedResult);
      } catch {
        setErrorMessage("通信に失敗しました。時間をおいて再試行してください。");
      }
    }

    void load();
  }, []);

  if (errorMessage) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-5 py-8" data-testid="today-page">
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-base text-rose-900" role="alert">
          {errorMessage}
        </p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-5 py-8" data-testid="today-page">
        <p className="text-base text-muted-foreground">今日確認することを読み込み中...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-5 py-8 sm:px-8" data-testid="today-page">
      <nav className="flex flex-wrap gap-3 text-sm text-muted-foreground" aria-label="メインナビゲーション">
        <Link href="/today" className="font-medium text-foreground">Today</Link>
        <Link href="/rules" className="underline-offset-4 hover:underline">ルール体系</Link>
        <Link href="/portfolio" className="underline-offset-4 hover:underline">ポートフォリオ</Link>
        <Link href="/notifications" className="underline-offset-4 hover:underline">通知</Link>
      </nav>

      <header className="mt-8">
        <p className="text-sm font-medium text-muted-foreground">Today</p>
        <h1 className="mt-2 text-3xl font-semibold">今日確認すべきこと</h1>
        <p className="mt-3 text-base leading-[1.7] text-muted-foreground">
          状態が変わったものと、確認期限を過ぎたものだけを表示しています。
        </p>
      </header>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <StatValue label="保有銘柄" value={`${data.stats.positionsCount}件`} />
        <StatValue label="承認済みルール" value={`${data.stats.rulesApproved}件`} />
        <StatValue label="要確認のルール" value={`${data.stats.rulesNeedingCheck}件`} />
      </div>

      {data.items.length === 0 ? (
        <section className="flex min-h-[42vh] flex-col items-center justify-center text-center" data-testid="today-empty-state">
          <h2 className="text-2xl font-semibold">今日は確認することがありません。</h2>
          <p className="mt-4 text-base leading-[1.7] text-muted-foreground">
            ルールを守って何もしない日は、良い日です。
          </p>
        </section>
      ) : (
        <section className="mt-8 space-y-3" aria-label="今日の確認事項" data-testid="today-feed-items">
          {data.items.map((item, index) => (
            <Link
              key={`${item.kind}-${item.href}-${index}`}
              href={item.href}
              className="flex min-h-20 items-center gap-4 rounded-xl border bg-background p-4 transition hover:bg-muted/40 focus-visible:ring-2"
              data-testid={`today-item-${item.kind}`}
            >
              <AttentionBadge status={item.status} size="md" />
              <span className="min-w-0 flex-1 truncate text-base font-medium">{item.title}</span>
              <span className="shrink-0 text-xl text-muted-foreground" aria-hidden="true">→</span>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}

"use client";

import type { DbWatchlistItem } from "@/features/watchlist/types/watchlist-item";

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  if (value == null || value === "") return null;
  return (
    <div className="flex items-start gap-2">
      <dt className="min-w-32 text-xs font-medium text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm">{String(value)}</dd>
    </div>
  );
}

function TagsDisplay({ tags }: { tags: string[] | null | undefined }) {
  if (!tags || tags.length === 0) return null;
  return (
    <div className="flex items-start gap-2">
      <dt className="min-w-32 text-xs font-medium text-muted-foreground">
        タグ
      </dt>
      <dd className="flex flex-wrap gap-1">
        {tags.map((tag) => (
          <span
            key={tag}
            className="rounded-md bg-gray-100 px-2 py-0.5 text-xs"
          >
            {tag}
          </span>
        ))}
      </dd>
    </div>
  );
}

export function WatchlistItemDetail({
  item,
}: {
  item: DbWatchlistItem;
}) {
  return (
    <section className="rounded-lg border p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold">{item.ticker}</h2>
        {item.company_name ? (
          <p className="mt-1 text-sm text-muted-foreground">
            {item.company_name}
          </p>
        ) : null}
      </div>

      <dl className="space-y-3">
        <DetailRow label="市場" value={item.market} />
        <DetailRow label="通貨" value={item.currency} />
        <DetailRow label="ステータス" value={item.status} />
        <DetailRow label="優先度" value={item.priority} />
        <DetailRow label="気になる理由" value={item.interest_reason} />
        <DetailRow
          label="買付価格 下限"
          value={
            item.target_price_min != null
              ? `${item.target_price_min}`
              : null
          }
        />
        <DetailRow
          label="買付価格 上限"
          value={
            item.target_price_max != null
              ? `${item.target_price_max}`
              : null
          }
        />
        <DetailRow label="分割回数" value={item.planned_tranches} />
        <DetailRow label="目標倍率" value={item.target_multiple} />
        <DetailRow
          label="最大投資比率"
          value={
            item.max_position_percent != null
              ? `${item.max_position_percent}%`
              : null
          }
        />
        <DetailRow label="損切り・見直し条件" value={item.stop_loss_note} />
        <DetailRow label="利確・出口条件" value={item.take_profit_note} />
        <DetailRow label="決算メモ" value={item.earnings_note} />
        <DetailRow label="調査メモ" value={item.research_notes} />
        <TagsDisplay tags={item.tags} />
        <DetailRow
          label="最終レビュー日"
          value={
            item.last_reviewed_at
              ? new Date(item.last_reviewed_at).toLocaleString("ja-JP")
              : null
          }
        />
      </dl>
    </section>
  );
}

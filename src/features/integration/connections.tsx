import { getDb } from "@/lib/db";

import { listIntegrationGrants } from "./api-keys";

const dateFormat = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Tokyo",
});

function ConnectionTime({ value }: { value: string | null }) {
  return value ? (
    <time dateTime={value}>{dateFormat.format(new Date(value))}</time>
  ) : (
    "未使用"
  );
}

export function IntegrationConnections() {
  const grants = listIntegrationGrants(getDb());
  const now = new Date().toISOString();

  return (
    <section
      id="connections"
      className="scroll-mt-6 space-y-2"
      aria-labelledby="connections-heading"
    >
      <h2 id="connections-heading" className="section-label">
        接続
      </h2>
      <div className="surface">
        {grants.length ? (
          <ul className="divide-y">
            {grants.map((grant) => (
              <li
                key={grant.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
              >
                <div className="space-y-1">
                  <h3 className="font-medium">
                    {grant.kind === "oauth" ? "OAuth（Muse）" : "API キー"}
                  </h3>
                  <p className="text-sm">{grant.scopes.join("、")}</p>
                  <dl className="text-xs text-muted-foreground">
                    <div className="flex gap-2">
                      <dt>有効期限</dt>
                      <dd>
                        <ConnectionTime value={grant.expiresAt} />
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt>最終使用</dt>
                      <dd>
                        <ConnectionTime value={grant.lastUsedAt} />
                      </dd>
                    </div>
                  </dl>
                </div>
                {grant.revokedAt || grant.expiresAt <= now ? (
                  <p className="text-sm text-muted-foreground">
                    {grant.revokedAt ? "取り消し済み" : "期限切れ"}
                  </p>
                ) : (
                  <form method="post" action="/more/connections/revoke">
                    <input type="hidden" name="grant_id" value={grant.id} />
                    <button
                      type="submit"
                      className="rounded-md border px-3 py-2 text-sm hover:bg-muted"
                    >
                      取り消す
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-4 text-sm text-muted-foreground">
            接続はありません。
          </p>
        )}
      </div>
    </section>
  );
}

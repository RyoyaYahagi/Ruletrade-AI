"use client";

export type QualityCheckData = {
  checkKey: string;
  label: string;
  status: "pass" | "warning" | "fail";
  severity: string;
  reason: string;
  relatedTickers?: string[];
  suggestedQuestion?: string;
};

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pass: "bg-green-100 text-green-800",
    warning: "bg-yellow-100 text-yellow-800",
    fail: "bg-red-100 text-red-800",
  };
  const labels: Record<string, string> = {
    pass: "OK",
    warning: "注意",
    fail: "要対応",
  };
  return (
    <span
      className={`rounded-full px-2 py-1 text-xs font-medium ${colors[status] ?? "bg-gray-100 text-gray-800"}`}
    >
      {labels[status] ?? status}
    </span>
  );
}

export function WatchlistQualityChecksList({
  checks,
}: {
  checks: QualityCheckData[];
}) {
  if (checks.length === 0) {
    return (
      <section className="rounded-lg border p-6">
        <h3 className="text-sm font-medium">品質チェック</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          チェック結果はありません。
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border p-6">
      <h3 className="text-sm font-medium">品質チェック</h3>
      <div className="mt-4 space-y-3">
        {checks.map((check) => (
          <div key={check.checkKey} className="rounded-md border p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">{check.label}</p>
              <StatusBadge status={check.status} />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {check.reason}
            </p>
            {check.relatedTickers != null &&
            check.relatedTickers.length > 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                関連銘柄: {check.relatedTickers.join(", ")}
              </p>
            ) : null}
            {check.suggestedQuestion ? (
              <p className="mt-2 rounded-md bg-blue-50 p-2 text-xs text-blue-700">
                確認質問: {check.suggestedQuestion}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

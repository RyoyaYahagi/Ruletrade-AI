export function QualityChecksList({
  qualityChecks,
}: {
  qualityChecks: Array<{
    id: string;
    label: string;
    status: string;
    reason: string;
    suggested_question?: string | null;
  }>;
}) {
  if (!qualityChecks || qualityChecks.length === 0) {
    return (
      <div>
        <h3 className="font-semibold">Quality Check</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          チェック項目はまだありません。
        </p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="font-semibold">Quality Check</h3>

      <div className="mt-3 space-y-3">
        {qualityChecks.map((check) => (
          <div key={check.id} className="rounded-md border p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium">{check.label}</p>
              <span className="rounded-full bg-gray-100 px-2 py-1 text-xs">
                {check.status}
              </span>
            </div>

            <p className="mt-2 text-sm text-muted-foreground">{check.reason}</p>

            {check.suggested_question ? (
              <p className="mt-2 rounded-md bg-gray-50 p-3 text-sm">
                次の質問案: {check.suggested_question}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

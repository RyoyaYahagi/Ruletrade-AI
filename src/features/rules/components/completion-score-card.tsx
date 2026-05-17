export function CompletionScoreCard({ score }: { score: number | null }) {
  const safeScore = score ?? 0;

  return (
    <div className="rounded-lg bg-gray-50 p-4">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            完成度スコア
          </p>
          <p className="mt-1 text-3xl font-bold">
            {safeScore}
            <span className="text-base font-normal text-muted-foreground">
              /100
            </span>
          </p>
        </div>

        <p className="text-sm text-muted-foreground">
          {getScoreLabel(safeScore)}
        </p>
      </div>

      <div className="mt-4 h-2 rounded-full bg-gray-200">
        <div
          className="h-2 rounded-full bg-black"
          style={{
            width: `${Math.min(100, Math.max(0, safeScore))}%`,
          }}
        />
      </div>
    </div>
  );
}

function getScoreLabel(score: number) {
  if (score >= 80) {
    return "完成に近い";
  }

  if (score >= 60) {
    return "あと少し";
  }

  return "要整理";
}

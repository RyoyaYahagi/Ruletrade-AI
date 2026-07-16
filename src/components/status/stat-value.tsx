import { Minus, TrendingDown, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";

export function StatValue({
  label,
  value,
  change,
  className,
}: {
  label: string;
  value: React.ReactNode;
  change?: number;
  className?: string;
}) {
  const ChangeIcon =
    change == null ? Minus : change > 0 ? TrendingUp : TrendingDown;
  const changeClassName =
    change == null
      ? "text-muted-foreground"
      : change > 0
        ? "text-emerald-700"
        : "text-rose-700";

  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl leading-tight font-semibold tabular-nums">{value}</p>
      {change != null ? (
        <p className={cn("mt-1 flex items-center gap-1 text-sm", changeClassName)}>
          <ChangeIcon className="size-3.5" aria-hidden="true" />
          {change > 0 ? "+" : ""}{change}%
        </p>
      ) : null}
    </div>
  );
}

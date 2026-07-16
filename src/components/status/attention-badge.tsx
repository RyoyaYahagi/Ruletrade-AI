import { AlertTriangle, CheckCircle2, CircleAlert } from "lucide-react";

import type { AttentionStatus } from "@/features/ux/services/attention-status-service";
import { cn } from "@/lib/utils";

const statusConfig: Record<
  AttentionStatus,
  { label: string; className: string; Icon: typeof CheckCircle2 }
> = {
  on_track: {
    label: "ルール内",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    Icon: CheckCircle2,
  },
  needs_check: {
    label: "要確認",
    className: "border-amber-200 bg-amber-50 text-amber-900",
    Icon: AlertTriangle,
  },
  condition_met: {
    label: "条件成立",
    className: "border-rose-200 bg-rose-50 text-rose-900",
    Icon: CircleAlert,
  },
};

export function AttentionBadge({
  status,
  size = "sm",
  className,
}: {
  status: AttentionStatus;
  size?: "sm" | "md";
  className?: string;
}) {
  const config = statusConfig[status];
  const Icon = config.Icon;

  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-full border font-medium",
        config.className,
        size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm",
        className,
      )}
      role="status"
      aria-label={`状態: ${config.label}`}
      data-testid={`attention-badge-${status}`}
    >
      <Icon className={size === "sm" ? "size-3.5" : "size-4"} aria-hidden="true" />
      <span>{config.label}</span>
    </span>
  );
}

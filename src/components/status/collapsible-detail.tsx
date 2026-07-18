import type { ReactNode } from "react";

export function CollapsibleDetail({
  summary,
  children,
  defaultOpen = false,
  open,
  onToggle,
}: {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onToggle?: (open: boolean) => void;
}) {
  return (
    <details
      className="group rounded-lg border bg-background"
      open={open ?? defaultOpen}
      onToggle={(event) => onToggle?.(event.currentTarget.open)}
    >
      <summary className="cursor-pointer list-none px-4 py-3 text-base font-medium [&::-webkit-details-marker]:hidden">
        <span className="mr-2 inline-block transition-transform group-open:rotate-90" aria-hidden="true">
          ›
        </span>
        {summary}
      </summary>
      <div className="border-t px-4 py-4 text-base leading-[1.7] text-muted-foreground">
        {children}
      </div>
    </details>
  );
}

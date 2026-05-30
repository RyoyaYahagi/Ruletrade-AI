"use client";

import { InfoIcon } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  getGlossaryTerm,
  type GlossaryTermKey,
} from "@/features/glossary/glossary-terms";
import { cn } from "@/lib/utils";

type InlineHelpProps = {
  termKey: GlossaryTermKey;
  className?: string;
  iconClassName?: string;
  showLabel?: boolean;
};

/**
 * InlineHelp displays a small info icon next to text.
 *
 * Clicking (or keyboard focusing) the icon opens a popover
 * with a short, plain-language explanation of the investment term.
 *
 * Accessibility:
 * - Icon-only trigger has an aria-label
 * - Popover content is announced by screen readers
 * - Keyboard focusable and closable with Escape
 */
export function InlineHelp({
  termKey,
  className,
  iconClassName,
  showLabel = false,
}: InlineHelpProps) {
  const term = getGlossaryTerm(termKey);

  if (!term) {
    // Graceful degradation: unknown term renders nothing
    return null;
  }

  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "inline-flex items-center gap-1 align-middle text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm transition-colors",
          className,
        )}
        aria-label={`${term.label}の説明を表示`}
      >
        <InfoIcon className={cn("size-4", iconClassName)} aria-hidden />
        {showLabel && (
          <span className="text-xs underline underline-offset-2">
            {term.label}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent side="top" align="center" sideOffset={4}>
        <PopoverHeader>
          <PopoverTitle>{term.label}</PopoverTitle>
        </PopoverHeader>
        <PopoverDescription>{term.shortDescription}</PopoverDescription>
        {term.relatedTerms && term.relatedTerms.length > 0 && (
          <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
            <span className="font-medium">関連する用語:</span>{" "}
            {term.relatedTerms
              .map((k) => getGlossaryTerm(k)?.label ?? k)
              .join("、")}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

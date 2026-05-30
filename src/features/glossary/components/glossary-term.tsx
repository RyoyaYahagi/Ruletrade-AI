"use client";

import {
  getGlossaryTerm,
  type GlossaryTermKey,
} from "@/features/glossary/glossary-terms";

type GlossaryTermProps = {
  termKey: GlossaryTermKey;
  children?: React.ReactNode;
};

/**
 * Displays a glossary term label with optional inline help.
 *
 * If children are provided, they are rendered as the term text
 * and the help icon is appended. If no children are provided,
 * the term's default label is rendered.
 */
export function GlossaryTerm({ termKey, children }: GlossaryTermProps) {
  const term = getGlossaryTerm(termKey);

  if (!term) {
    // Fallback for unknown terms: render key as-is
    return <span className="text-muted-foreground">{termKey}</span>;
  }

  return (
    <span className="inline-flex items-center gap-1">
      {children ?? term.label}
    </span>
  );
}

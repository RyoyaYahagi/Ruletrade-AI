"use client";

import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { FeedbackDialog } from "@/components/feedback/FeedbackDialog";

export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="surface flex min-h-15 w-full items-center justify-between gap-3 px-5 py-3 text-left"
      >
        <span>
          <span className="block font-medium">お問い合わせ・改善要望</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            話して送ることもできます
          </span>
        </span>
        <ChevronRight aria-hidden size={18} className="text-muted-foreground" />
      </button>
      <FeedbackDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

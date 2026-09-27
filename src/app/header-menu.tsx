"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { FeedbackDialog } from "@/components/feedback/FeedbackDialog";

export function HeaderMenu() {
  const [open, setOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={containerRef}
      className="relative shrink-0"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label="補助メニュー"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen(!open)}
        className="flex size-10 items-center justify-center rounded-lg text-2xl text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
      >
        <span aria-hidden="true">⋯</span>
      </button>
      {open && (
        <div id={menuId} className="absolute right-0 top-full z-10 mt-2 min-w-36 rounded-lg border bg-card p-1 shadow-sm">
          <Link
            href="/data"
            onClick={() => setOpen(false)}
            className="block rounded-md px-3 py-2 text-sm hover:bg-secondary/50"
          >
            データ管理
          </Link>
          <button
            type="button"
            onClick={() => { setOpen(false); setFeedbackOpen(true); }}
            className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-secondary/50"
          >
            お問い合わせ・改善要望
          </button>
        </div>
      )}
      <FeedbackDialog open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </div>
  );
}

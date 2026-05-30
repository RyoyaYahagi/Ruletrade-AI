"use client";

import { useEffect, useState } from "react";

export function LiveRegion({
  message,
  priority = "polite",
}: {
  message: string;
  priority?: "polite" | "assertive";
}) {
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    if (!message) return;
    const timer1 = setTimeout(() => setAnnouncement(message), 0);
    const timer2 = setTimeout(() => setAnnouncement(""), 1000);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [message]);

  return (
    <div aria-live={priority} aria-atomic="true" className="sr-only">
      {announcement}
    </div>
  );
}

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type LiveRegionContextValue = {
  announce: (message: string, politeness?: "polite" | "assertive") => void;
};

const LiveRegionContext = createContext<LiveRegionContextValue | null>(null);

export function LiveRegionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [politeMessage, setPoliteMessage] = useState("");
  const [assertiveMessage, setAssertiveMessage] = useState("");

  const announce = useCallback(
    (message: string, politeness: "polite" | "assertive" = "polite") => {
      if (politeness === "assertive") {
        setAssertiveMessage("");
        window.setTimeout(() => setAssertiveMessage(message), 10);
      } else {
        setPoliteMessage("");
        window.setTimeout(() => setPoliteMessage(message), 10);
      }
    },
    [],
  );

  const value = useMemo(() => ({ announce }), [announce]);

  return (
    <LiveRegionContext.Provider value={value}>
      {children}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {politeMessage}
      </div>
      <div aria-live="assertive" aria-atomic="true" className="sr-only">
        {assertiveMessage}
      </div>
    </LiveRegionContext.Provider>
  );
}

export function useLiveRegion() {
  const context = useContext(LiveRegionContext);
  if (!context) {
    throw new Error("useLiveRegion must be used within LiveRegionProvider.");
  }
  return context;
}

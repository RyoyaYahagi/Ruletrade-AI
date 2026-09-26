import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Ruletrade-AI",
  description: "投資した理由を残し、未来の自分とAIで振り返る意思決定ジャーナル",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}

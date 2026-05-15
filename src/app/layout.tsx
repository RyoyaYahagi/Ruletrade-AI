import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ruletrade-AI",
  description: "AIと一緒に投資ルールを作成・レビューするアプリです。",
  applicationName: "Ruletrade-AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

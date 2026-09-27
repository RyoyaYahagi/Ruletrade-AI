import type { Metadata } from "next";
import Link from "next/link";
import { HeaderMenu } from "./header-menu";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ruletrade-AI",
  description: "投資判断を残し、過去の自分の考えを振り返るジャーナルです。",
  applicationName: "Ruletrade-AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <header className="app-header">
          <Link href="/" className="brand">Ruletrade</Link>
          <nav aria-label="メインナビゲーション">
            <Link href="/">記録</Link>
            <Link href="/transactions">売買履歴</Link>
          </nav>
          <HeaderMenu />
        </header>
        {children}
      </body>
    </html>
  );
}

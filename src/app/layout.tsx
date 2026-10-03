import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans_JP, Shippori_Mincho } from "next/font/google";
import { AppNav, BottomNavSpacer } from "./app-nav";
import "./globals.css";

// 日本語フォントはサイズが大きいため preload せず、表示時に必要な範囲だけ読み込ませる。
const plexSansJp = IBM_Plex_Sans_JP({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  preload: false,
  variable: "--font-plex-sans-jp",
});
const shipporiMincho = Shippori_Mincho({
  weight: ["500", "600"],
  subsets: ["latin"],
  preload: false,
  variable: "--font-shippori-mincho",
});
const plexMono = IBM_Plex_Mono({
  weight: ["500"],
  subsets: ["latin"],
  variable: "--font-plex-mono",
});

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
    <html
      lang="ja"
      className={`h-full antialiased ${plexSansJp.variable} ${shipporiMincho.variable} ${plexMono.variable}`}
    >
      <body className="min-h-full flex flex-col">
        <AppNav />
        {children}
        <BottomNavSpacer />
      </body>
    </html>
  );
}

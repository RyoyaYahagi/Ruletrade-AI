"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  Ellipsis,
  House,
  List,
  Plus,
  type LucideIcon,
} from "lucide-react";

const items: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/", label: "今日", icon: House },
  { href: "/portfolio", label: "銘柄", icon: List },
  { href: "/capture", label: "記録", icon: Plus },
  { href: "/transactions", label: "売買", icon: ArrowLeftRight },
  { href: "/more", label: "その他", icon: Ellipsis },
];

function isCurrent(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

// 記録・確認・銘柄詳細は画面下部に固有の操作バーを持つため、スマホでは下部ナビを出さない。
function hidesBottomNav(pathname: string) {
  return pathname.startsWith("/capture") || pathname.startsWith("/stocks/");
}

export function AppNav() {
  const pathname = usePathname();
  return (
    <>
      <header className="hidden border-b bg-card md:block">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-8 px-6">
          <Link href="/" className="font-semibold tracking-tight">
            Ruletrade
          </Link>
          <nav aria-label="メインナビゲーション" className="flex items-center gap-1 text-sm">
            {items.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                aria-current={isCurrent(pathname, href) ? "page" : undefined}
                className="rounded-lg px-3 py-2 text-muted-foreground hover:text-foreground aria-[current=page]:font-semibold aria-[current=page]:text-primary"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      {!hidesBottomNav(pathname) && (
        <nav
          aria-label="メインナビゲーション（下部）"
          className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 items-end border-t bg-card px-1 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] md:hidden"
        >
          {items.map(({ href, label, icon: Icon }) =>
            href === "/capture" ? (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center gap-1 text-[11px] font-semibold"
              >
                <span className="-mt-6 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_6px_16px_rgb(30_106_75/0.35)]">
                  <Icon aria-hidden size={26} strokeWidth={2.2} />
                </span>
                {label}
              </Link>
            ) : (
              <Link
                key={href}
                href={href}
                aria-current={isCurrent(pathname, href) ? "page" : undefined}
                className="flex min-h-12 flex-col items-center justify-center gap-1 text-[11px] text-muted-foreground aria-[current=page]:font-semibold aria-[current=page]:text-primary"
              >
                <Icon aria-hidden size={22} strokeWidth={1.9} />
                {label}
              </Link>
            ),
          )}
        </nav>
      )}
    </>
  );
}

export function BottomNavSpacer() {
  const pathname = usePathname();
  if (hidesBottomNav(pathname)) return null;
  return <div aria-hidden className="h-24 md:hidden" />;
}

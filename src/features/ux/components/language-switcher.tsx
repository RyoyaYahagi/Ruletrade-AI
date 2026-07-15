"use client";

import { usePathname, useRouter } from "next/navigation";
import { SUPPORTED_LOCALES, type SupportedLocale } from "@/i18n/locales";

export function LanguageSwitcher({
  currentLocale,
}: {
  currentLocale: SupportedLocale;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function switchLocale(nextLocale: SupportedLocale) {
    const segments = pathname.split("/");
    if (SUPPORTED_LOCALES.includes(segments[1] as SupportedLocale)) {
      segments[1] = nextLocale;
      router.push(segments.join("/"));
      return;
    }
    router.push(`/${nextLocale}${pathname}`);
  }

  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <span>Language</span>
      <select
        value={currentLocale}
        onChange={(event) =>
          switchLocale(event.target.value as SupportedLocale)
        }
        className="rounded-md border px-3 py-2"
      >
        <option value="ja">日本語</option>
        <option value="en">English</option>
      </select>
    </label>
  );
}

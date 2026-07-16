import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { PortfolioTargetsForm } from "@/features/portfolio/components/portfolio-targets-form";

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto max-w-4xl p-6">
      <a href="/portfolio" className="text-sm text-muted-foreground hover:underline">← ポートフォリオに戻る</a>
      <h1 className="mt-2 text-2xl font-bold">ターゲット配分</h1>
      <p className="mt-2 text-sm text-muted-foreground">自分で決めた目標比率からのズレを、日次で確認できるようにします。</p>
      <div className="mt-6"><PortfolioTargetsForm /></div>
    </main>
  );
}

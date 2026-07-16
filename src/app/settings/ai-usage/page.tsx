import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { AiUsagePanel } from "@/features/ai/components/ai-usage-panel";

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">AI利用状況</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          今月のAI利用額と上限を確認できます。
        </p>
      </div>
      <AiUsagePanel />
    </main>
  );
}

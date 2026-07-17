import { redirect } from "next/navigation";

import { ApiTokenSettings } from "@/features/auth/components/api-token-settings";
import { getCurrentUser } from "@/lib/auth/get-current-user";

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">外部エージェント連携</h1>
        <p className="mt-2 text-sm text-muted-foreground">Personal Access Tokenを使って、ルールの閲覧と下書き入力を外部エージェントから行えます。</p>
      </div>
      <ApiTokenSettings />
    </main>
  );
}

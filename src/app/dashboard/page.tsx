import { redirect } from "next/navigation";

import { LogoutButton } from "@/features/auth/components/logout-button";
import { getCurrentUser } from "@/lib/auth/get-current-user";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-5 py-8 sm:px-8">
      <div className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Dashboard</p>
          <h1 className="mt-2 text-2xl font-semibold">Ruletrade-AI</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            ログイン中: {user.email}
          </p>
        </div>
        <LogoutButton />
      </div>

      <section className="rounded-lg border bg-background p-5">
        <h2 className="text-base font-medium">認証状態</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          このページはログイン済みユーザーだけが表示できます。投資ルールやレビュー履歴は、後続のDB/RLS実装でユーザーごとに分離します。
        </p>
      </section>
    </main>
  );
}

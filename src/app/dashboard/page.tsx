import { redirect } from "next/navigation";
import Link from "next/link";

import { LogoutButton } from "@/features/auth/components/logout-button";
import { getCurrentUser } from "@/lib/auth/get-current-user";

export const dynamic = "force-dynamic";

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
            AIと一緒に、買う前の投資ルールを整理します。
          </p>
        </div>
        <LogoutButton />
      </div>

      <section className="rounded-lg border bg-background p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-medium">投資ルール作成</h2>
          <Link
            href="/rules/new"
            className="rounded-md bg-black px-4 py-2 text-sm text-white"
          >
            新しいルールを作る
          </Link>
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          銘柄コードを入力して、AIが質問しながら買い方・損切り・利確・最大投資比率を整理します。
        </p>
      </section>
    </main>
  );
}

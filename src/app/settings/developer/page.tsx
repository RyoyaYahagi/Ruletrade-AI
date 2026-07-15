import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { DeveloperAiSettingsForm } from "@/features/ai/components/developer-ai-settings-form";

export default async function Page() {
  if (process.env.NODE_ENV === "production") notFound();

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold">Developer Settings</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        AI Providerとモデルの開発用設定です。
      </p>
      <div className="mt-6">
        <DeveloperAiSettingsForm />
      </div>
    </main>
  );
}

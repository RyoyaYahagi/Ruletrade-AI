import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { AccessibilitySettingsForm } from "@/features/ux/components/accessibility-settings-form";

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold">Accessibility Settings</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        表示、動き、読みやすさに関する設定を変更できます。
      </p>
      <div className="mt-6">
        <AccessibilitySettingsForm />
      </div>
      {process.env.NODE_ENV !== "production" ? (
        <div className="mt-6 rounded-lg border border-dashed p-4 text-sm">
          <p className="font-medium">開発者向け設定</p>
          <p className="mt-1 text-muted-foreground">
            AI Providerと使用モデルを切り替えられます。
          </p>
          <Link className="mt-3 inline-block underline" href="/settings/developer">
            Developer Settingsを開く
          </Link>
        </div>
      ) : null}
    </main>
  );
}

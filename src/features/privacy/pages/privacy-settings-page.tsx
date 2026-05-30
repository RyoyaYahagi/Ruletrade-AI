import { PrivacySettingsForm } from "@/features/privacy/components/privacy-settings-form";
import { DataExportPanel } from "@/features/privacy/components/data-export-panel";
import { RagMemoryDeletePanel } from "@/features/privacy/components/rag-memory-delete-panel";
import { AccountDeletePanel } from "@/features/privacy/components/account-delete-panel";

export function PrivacySettingsPage() {
  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-bold">Privacy Settings</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        AIが参照するメモリ、資料、ログ、データ削除を管理します。
      </p>
      <div className="mt-6 space-y-6">
        <PrivacySettingsForm />
        <DataExportPanel />
        <RagMemoryDeletePanel />
        <AccountDeletePanel />
      </div>
    </main>
  );
}

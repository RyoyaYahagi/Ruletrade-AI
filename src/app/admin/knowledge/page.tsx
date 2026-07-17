import { requireAdmin } from "@/lib/auth/require-admin";
import { AdminKnowledgePanel } from "@/features/knowledge/components/admin-knowledge-panel";

export default async function AdminKnowledgePage() {
  await requireAdmin();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">専門家解説ナレッジ</h1>
        <p className="mt-2 text-sm text-muted-foreground">権利処理済みの一般的な教育コンテンツを管理します。</p>
      </div>
      <AdminKnowledgePanel />
    </div>
  );
}

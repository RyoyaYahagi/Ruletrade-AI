import { AdminAiUsagePanel } from "@/features/ai/components/admin-ai-usage-panel";

export default function AdminAiUsagePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI Usage Management</h1>
        <p className="mt-2 text-sm text-gray-600">
          全体のAI利用額とモデル単価を管理します。
        </p>
      </div>
      <AdminAiUsagePanel />
    </div>
  );
}

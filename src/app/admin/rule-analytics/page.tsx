import { AdminRuleAnalyticsPanel } from "@/features/rules/components/admin-rule-analytics-panel";

export default function AdminRuleAnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Rule Flow Analytics</h1>
        <p className="mt-2 text-sm text-gray-600">
          質問フローの継続率、質問別離脱、AI下書きの利用状況を確認します。
        </p>
      </div>
      <AdminRuleAnalyticsPanel />
    </div>
  );
}

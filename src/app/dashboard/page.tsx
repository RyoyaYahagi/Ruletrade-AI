import { redirect } from "next/navigation";

import { AgentWorkbench } from "@/features/rules/components/rule-agent-workbench";
import { listRuleSessions } from "@/features/rules/services/rule-session-service";
import { listAttentionStatuses } from "@/features/ux/services/attention-status-service";
import { getCurrentUser } from "@/lib/auth/get-current-user";


export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const [{ sessions }, statuses] = await Promise.all([
    listRuleSessions({ userId: user.id }),
    listAttentionStatuses({ userId: user.id }),
  ]);

  return (
    <AgentWorkbench
      ruleSessions={sessions}
      attentionStatuses={Object.fromEntries(statuses)}
    />
  );
}

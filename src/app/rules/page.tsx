import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { RuleSystemOverview } from "@/features/rules/components/rule-system-overview";
import { getRuleSystemOverview } from "@/features/rules/services/rule-system-overview-service";
import { getCurrentUser } from "@/lib/auth/get-current-user";

export const metadata: Metadata = {
  title: "ルール体系",
};

export default async function RulesPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const overview = await getRuleSystemOverview({ userId: user.id });

  return <RuleSystemOverview overview={overview} />;
}

import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/get-current-user";
import { RuleSessionPage } from "@/features/rules/pages/rule-session-page";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const { sessionId } = await params;

  return <RuleSessionPage sessionId={sessionId} />;
}

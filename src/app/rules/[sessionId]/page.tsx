import { RuleSessionPage } from "@/features/rules/pages/rule-session-page";

export default async function Page({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  return <RuleSessionPage sessionId={sessionId} />;
}

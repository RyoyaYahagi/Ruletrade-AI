import { RuleSessionShell } from "@/features/rules/components/rule-session-shell";

export function RuleSessionPage({ sessionId }: { sessionId: string }) {
  return (
    <main className="mx-auto max-w-7xl p-6">
      <RuleSessionShell sessionId={sessionId} />
    </main>
  );
}

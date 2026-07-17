import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { NewsAssessmentHistory } from "@/features/news/components/news-assessment-history";

export default async function Page({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { sessionId } = await params;

  return (
    <main className="mx-auto max-w-4xl p-6">
      <a href={`/rules/${sessionId}`} className="text-sm text-muted-foreground hover:underline">← ルール詳細に戻る</a>
      <h1 className="mt-2 text-2xl font-bold">ニュース判定履歴</h1>
      <p className="mt-2 text-sm text-muted-foreground">保有・ウォッチ銘柄に関するニュースを、あなたの仮説との関係で確認します。</p>
      <div className="mt-6"><NewsAssessmentHistory sessionId={sessionId} /></div>
    </main>
  );
}

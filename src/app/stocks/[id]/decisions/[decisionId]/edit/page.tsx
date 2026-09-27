import { notFound } from "next/navigation";
import { getStockTimelineAction } from "@/features/decisions/actions";
import { DecisionEditForm } from "@/features/decisions/decision-edit-form";

export const dynamic = "force-dynamic";

export default async function DecisionEditPage({
  params,
}: {
  params: Promise<{ id: string; decisionId: string }>;
}) {
  const { id, decisionId } = await params;
  let data;
  try {
    data = await getStockTimelineAction({ stockId: id });
  } catch {
    notFound();
  }
  const decision = data.decisions.find((item) => item.id === decisionId);
  if (!decision) notFound();
  return (
    <main className="page-shell">
      <DecisionEditForm stock={data.stock} decision={decision} />
    </main>
  );
}

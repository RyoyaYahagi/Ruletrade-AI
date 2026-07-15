import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { WatchlistItemDetailPage } from "@/features/watchlist/pages/watchlist-item-detail-page";


export default async function Page({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { itemId } = await params;

  return <WatchlistItemDetailPage itemId={itemId} />;
}

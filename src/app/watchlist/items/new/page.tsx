import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { NewWatchlistItemPage } from "@/features/watchlist/pages/new-watchlist-item-page";

export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <NewWatchlistItemPage />;
}

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { WatchlistPage } from "@/features/watchlist/pages/watchlist-page";

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <WatchlistPage />;
}

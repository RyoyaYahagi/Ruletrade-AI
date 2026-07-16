import { redirect } from "next/navigation";

import { TodayFeed } from "@/features/ux/components/today-feed";
import { getCurrentUser } from "@/lib/auth/get-current-user";

export default async function TodayPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <TodayFeed />;
}

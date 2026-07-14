"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { signOut } from "@/features/auth/services/auth-client-service";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await signOut();
    router.replace("/login");
  }

  return (
    <Button type="button" variant="outline" onClick={handleLogout}>
      <LogOut />
      ログアウト
    </Button>
  );
}

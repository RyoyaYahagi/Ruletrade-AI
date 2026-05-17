"use client";

import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { signOut } from "@/features/auth/services/auth-client-service";

export function LogoutButton() {
  async function handleLogout() {
    await signOut();
    window.location.href = "/login";
  }

  return (
    <Button type="button" variant="outline" onClick={handleLogout}>
      <LogOut />
      ログアウト
    </Button>
  );
}

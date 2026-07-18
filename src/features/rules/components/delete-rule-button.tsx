"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function DeleteRuleButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleDelete() {
    if (
      !window.confirm(
        "この銘柄別ルールと関連する質問・回答を削除します。よろしいですか？",
      )
    ) {
      return;
    }

    setIsDeleting(true);
    setErrorMessage(null);
    try {
      const response = await fetch(
        `/api/rule-sessions/${encodeURIComponent(sessionId)}`,
        { method: "DELETE" },
      );
      const json = await response.json();
      if (!response.ok || !json.ok) {
        setErrorMessage(json.error?.message ?? "ルールの削除に失敗しました。");
        return;
      }
      router.push("/rules");
      router.refresh();
    } catch {
      setErrorMessage("通信に失敗しました。もう一度お試しください。");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        type="button"
        variant="destructive"
        size="sm"
        disabled={isDeleting}
        onClick={() => void handleDelete()}
      >
        <Trash2 />
        {isDeleting ? "削除中..." : "ルールを削除"}
      </Button>
      {errorMessage ? (
        <p className="max-w-56 text-right text-xs text-red-700" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}

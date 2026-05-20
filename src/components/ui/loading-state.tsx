"use client";

export function LoadingState({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-black" />
      <p className="mt-4 text-sm text-muted-foreground">
        {message ?? "読み込み中..."}
      </p>
    </div>
  );
}

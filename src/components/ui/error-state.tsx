"use client";

export function ErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <p className="text-sm text-red-700">
        {message ?? "エラーが発生しました"}
      </p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-md border px-4 py-2 text-sm"
        >
          再試行
        </button>
      ) : null}
    </div>
  );
}

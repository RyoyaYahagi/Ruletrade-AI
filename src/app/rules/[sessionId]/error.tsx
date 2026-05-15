"use client";

export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <h1 className="text-lg font-semibold text-red-800">
          ルール作成画面で問題が発生しました
        </h1>
        <p className="mt-2 text-sm text-red-700">
          ページの表示中にエラーが発生しました。入力済みの内容は保存されている可能性があります。
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-4 rounded-md border px-3 py-2 text-sm"
        >
          再試行
        </button>
      </div>
    </main>
  );
}

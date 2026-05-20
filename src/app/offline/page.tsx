export const dynamic = "force-dynamic";

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
      <h1 className="mb-2 text-2xl font-bold">オフライン</h1>
      <p className="mb-6 text-gray-600">
        現在インターネットに接続されていません。
        接続が回復すると自動的に復旧します。
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded bg-slate-900 px-4 py-2 text-white hover:bg-slate-800"
      >
        再読み込み
      </button>
    </div>
  );
}

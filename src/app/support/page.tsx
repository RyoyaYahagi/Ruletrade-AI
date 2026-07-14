import { SupportForm } from "@/features/support/components/support-form";

export default function SupportPage() {
  return (
    <main className="mx-auto max-w-lg px-6 py-12">
      <h1 className="text-2xl font-bold">サポート</h1>
      <p className="mt-2 text-sm text-gray-600">
        お困りのことや不具合の報告があれば、以下からお知らせください。
      </p>
      <div className="mt-6">
        <SupportForm />
      </div>
    </main>
  );
}

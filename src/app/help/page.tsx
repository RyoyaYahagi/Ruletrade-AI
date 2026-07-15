import { createDatabaseClient } from "@/lib/db/database-client";

export default async function HelpPage() {
  const db = await createDatabaseClient();
  const { data: articles } = await db
    .from("support_help_articles")
    .select("slug, title, category")
    .eq("is_published", true)
    .order("order_index");

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold">ヘルプセンター</h1>
      <ul className="mt-6 space-y-3">
        {(articles ?? []).map(
          (a: { slug: string; category: string; title: string }) => (
            <li key={a.slug} className="rounded border p-3">
              <span className="text-xs text-gray-500">{a.category}</span>
              <div className="font-medium">{a.title}</div>
            </li>
          ),
        )}
      </ul>
    </main>
  );
}

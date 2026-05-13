export default function HomePage() {
  return (
    <main className="min-h-screen bg-background p-8 text-foreground">
      <section className="mx-auto flex max-w-3xl flex-col gap-4 py-20">
        <p className="text-sm font-medium text-muted-foreground">
          Local setup ready
        </p>
        <h1 className="text-3xl font-bold">Ruletrade-AI</h1>
        <p className="max-w-2xl text-muted-foreground">
          AIと一緒に投資ルールを作成・レビューするアプリです。
        </p>
      </section>
    </main>
  );
}

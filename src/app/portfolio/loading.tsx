// 参考株価の取得に数秒かかるため、同じ形の骨格を先に出して待ち時間を伝える。
export default function PortfolioLoading() {
  return (
    <main className="page-shell space-y-6" aria-busy="true">
      <div className="space-y-4">
        <h1 className="page-title">ポートフォリオ</h1>
        <div className="grid grid-cols-2 border-b">
          <div className="flex min-h-12 items-center justify-center">
            <span className="skeleton h-4 w-20" />
          </div>
          <div className="flex min-h-12 items-center justify-center">
            <span className="skeleton h-4 w-20" />
          </div>
        </div>
      </div>
      <p className="sr-only" role="status">
        参考株価を取得しています
      </p>
      <section className="surface space-y-3 p-5">
        <span className="skeleton block h-4 w-28" />
        <span className="skeleton block h-8 w-44" />
        <span className="skeleton block h-4 w-36" />
      </section>
      <ul className="surface divide-y overflow-hidden">
        {[0, 1, 2, 3].map((index) => (
          <li
            key={index}
            className="flex items-center justify-between gap-3 px-5 py-4"
          >
            <span className="flex-1 space-y-2">
              <span className="skeleton block h-4 w-1/2" />
              <span className="skeleton block h-3 w-1/3" />
            </span>
            <span className="skeleton block h-4 w-16" />
          </li>
        ))}
      </ul>
    </main>
  );
}

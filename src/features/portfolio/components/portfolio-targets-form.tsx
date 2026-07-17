"use client";

import { useEffect, useMemo, useState } from "react";

type Target = {
  id: string;
  target_type: "cash_percent" | "position_max_percent" | "position_target_percent";
  target_key: string | null;
  target_percent: number;
  tolerance_percent: number;
};

type Position = { ticker: string; market_value: number | string | null };

export function PortfolioTargetsForm() {
  const [portfolioId, setPortfolioId] = useState<string | null>(null);
  const [targets, setTargets] = useState<Target[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [cash, setCash] = useState(0);
  const [cashTarget, setCashTarget] = useState(30);
  const [cashTolerance, setCashTolerance] = useState(5);
  const [maxTarget, setMaxTarget] = useState(10);
  const [maxTolerance, setMaxTolerance] = useState(5);
  const [symbol, setSymbol] = useState("");
  const [symbolTarget, setSymbolTarget] = useState(0);
  const [symbolTolerance, setSymbolTolerance] = useState(5);
  const [message, setMessage] = useState("");

  async function load() {
    const [portfolioResponse, positionsResponse] = await Promise.all([
      fetch("/api/portfolio"),
      fetch("/api/portfolio/positions"),
    ]);
    const portfolioJson = await portfolioResponse.json();
    const positionsJson = await positionsResponse.json();
    if (!portfolioJson.ok || !positionsJson.ok) return;

    const portfolio = portfolioJson.data.portfolio;
    setPortfolioId(portfolio.id);
    setCash(Number(portfolio.cash_amount ?? 0));
    setPositions(positionsJson.data.positions);

    const targetResponse = await fetch(
      `/api/portfolio/targets?portfolioId=${encodeURIComponent(portfolio.id)}`,
    );
    const targetJson = await targetResponse.json();
    if (!targetJson.ok) return;
    const nextTargets = targetJson.data.targets as Target[];
    setTargets(nextTargets);
    const cashConfig = nextTargets.find((target) => target.target_type === "cash_percent");
    const maxConfig = nextTargets.find(
      (target) => target.target_type === "position_max_percent" && target.target_key === "*",
    );
    if (cashConfig) {
      setCashTarget(cashConfig.target_percent);
      setCashTolerance(cashConfig.tolerance_percent);
    }
    if (maxConfig) {
      setMaxTarget(maxConfig.target_percent);
      setMaxTolerance(maxConfig.tolerance_percent);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const total = useMemo(
    () => cash + positions.reduce((sum, position) => sum + Number(position.market_value ?? 0), 0),
    [cash, positions],
  );

  function currentPercent(target: Target) {
    if (total === 0) return 0;
    if (target.target_type === "cash_percent") return (cash / total) * 100;
    const value = positions.find((position) => position.ticker === target.target_key)?.market_value;
    if (target.target_type === "position_max_percent" && target.target_key === "*") {
      return Math.max(...positions.map((position) => (Number(position.market_value ?? 0) / total) * 100), 0);
    }
    return Number(value ?? 0) / total * 100;
  }

  async function save(input: {
    targetType: Target["target_type"];
    targetKey?: string | null;
    targetPercent: number;
    tolerancePercent: number;
  }) {
    if (!portfolioId) return;
    const response = await fetch("/api/portfolio/targets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ portfolioId, ...input }),
    });
    const json = await response.json();
    setMessage(json.ok ? "保存しました。" : json.error?.message ?? "保存できませんでした。");
    if (json.ok) await load();
  }

  async function remove(targetId: string) {
    const response = await fetch(`/api/portfolio/targets/${targetId}`, { method: "DELETE" });
    const json = await response.json();
    setMessage(json.ok ? "削除しました。" : json.error?.message ?? "削除できませんでした。");
    if (json.ok) await load();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border p-6">
        <h2 className="text-lg font-semibold">現金比率の目標</h2>
        <TargetInputs
          target={cashTarget}
          tolerance={cashTolerance}
          onTargetChange={setCashTarget}
          onToleranceChange={setCashTolerance}
          onSave={() =>
            void save({
              targetType: "cash_percent",
              targetPercent: cashTarget,
              tolerancePercent: cashTolerance,
            })
          }
        />
      </section>

      <section className="rounded-lg border p-6">
        <h2 className="text-lg font-semibold">1銘柄の上限</h2>
        <p className="mt-1 text-sm text-muted-foreground">全銘柄に同じ上限を設定します。</p>
        <TargetInputs
          target={maxTarget}
          tolerance={maxTolerance}
          onTargetChange={setMaxTarget}
          onToleranceChange={setMaxTolerance}
          onSave={() =>
            void save({
              targetType: "position_max_percent",
              targetKey: "*",
              targetPercent: maxTarget,
              tolerancePercent: maxTolerance,
            })
          }
        />
      </section>

      <section className="rounded-lg border p-6">
        <h2 className="text-lg font-semibold">銘柄別の目標</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <input className="rounded-md border px-3 py-2" placeholder="銘柄コード" value={symbol} onChange={(event) => setSymbol(event.target.value)} />
          <input className="rounded-md border px-3 py-2" type="number" min={0} max={100} value={symbolTarget} onChange={(event) => setSymbolTarget(Number(event.target.value))} />
          <input className="rounded-md border px-3 py-2" type="number" min={1} max={20} value={symbolTolerance} onChange={(event) => setSymbolTolerance(Number(event.target.value))} />
          <button className="rounded-md bg-black px-3 py-2 text-white" type="button" onClick={() => void save({ targetType: "position_target_percent", targetKey: symbol, targetPercent: symbolTarget, tolerancePercent: symbolTolerance })}>銘柄目標を保存</button>
        </div>
      </section>

      <section className="rounded-lg border p-6">
        <h2 className="text-lg font-semibold">現在値との比較</h2>
        <div className="mt-4 space-y-4">
          {targets.map((target) => (
            <div key={target.id}>
              <div className="flex items-center justify-between text-sm">
                <span>{target.target_type === "cash_percent" ? "現金" : target.target_key ?? "全銘柄"}</span>
                <span>現在 {currentPercent(target).toFixed(1)}% / 目標 {target.target_percent}% ± {target.tolerance_percent}%</span>
              </div>
              <div className="relative mt-2 h-3 rounded-full bg-slate-100">
                <div className="absolute h-3 rounded-full bg-blue-100" style={{ left: `${Math.max(0, target.target_percent - target.tolerance_percent)}%`, width: `${Math.min(target.tolerance_percent * 2, 100)}%` }} />
                <div className="absolute top-[-2px] h-4 w-1 rounded bg-blue-700" style={{ left: `${Math.min(currentPercent(target), 100)}%` }} />
              </div>
              <button type="button" className="mt-1 text-xs text-muted-foreground underline" onClick={() => void remove(target.id)}>削除</button>
            </div>
          ))}
          {targets.length === 0 ? <p className="text-sm text-muted-foreground">まだターゲットが設定されていません。</p> : null}
        </div>
      </section>

      <p className="text-sm text-muted-foreground">よく紹介される例として、現金20〜40%・1銘柄10%以下の形があります。これは設定を決めるための参考例です。</p>
      {message ? <p role="status" className="text-sm">{message}</p> : null}
    </div>
  );
}

function TargetInputs(props: {
  target: number;
  tolerance: number;
  onTargetChange: (value: number) => void;
  onToleranceChange: (value: number) => void;
  onSave: () => void;
}) {
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-3">
      <label className="text-sm">目標(%)<input className="mt-1 w-full rounded-md border px-3 py-2" type="number" min={0} max={100} value={props.target} onChange={(event) => props.onTargetChange(Number(event.target.value))} /></label>
      <label className="text-sm">許容幅(%)<input className="mt-1 w-full rounded-md border px-3 py-2" type="number" min={1} max={20} value={props.tolerance} onChange={(event) => props.onToleranceChange(Number(event.target.value))} /></label>
      <button className="self-end rounded-md bg-black px-3 py-2 text-white" type="button" onClick={props.onSave}>保存</button>
    </div>
  );
}

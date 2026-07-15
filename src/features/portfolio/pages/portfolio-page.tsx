"use client";

import { useState } from "react";
import { PortfolioSummaryCard } from "@/features/portfolio/components/portfolio-summary-card";
import { PortfolioPositionTable } from "@/features/portfolio/components/portfolio-position-table";
import { PortfolioReviewPanel } from "@/features/portfolio/components/portfolio-review-panel";
import { PortfolioAllocationCharts } from "@/features/portfolio/components/portfolio-allocation-charts";
import { PortfolioCommonRulesPanel } from "@/features/portfolio/components/portfolio-common-rules-panel";
import { FundsPlanCard } from "@/features/portfolio/components/funds-plan-card";

export function PortfolioPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <main className="mx-auto max-w-6xl p-6" data-testid="portfolio-page">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="portfolio-title">Portfolio</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            保有銘柄の偏り、集中リスク、未設定ルールを確認します。
          </p>
        </div>

        <a
          href="/portfolio/positions/new"
          className="rounded-md bg-black px-4 py-2 text-sm text-white"
          data-testid="portfolio-add-position-link"
        >
          保有銘柄を追加
        </a>
      </div>

      <div className="mt-6 space-y-6" data-testid="portfolio-content">
        <PortfolioSummaryCard key={`summary-${refreshKey}`} />
        <FundsPlanCard />
        <PortfolioCommonRulesPanel key={`rules-${refreshKey}`} />
        <PortfolioAllocationCharts key={`charts-${refreshKey}`} />
        <PortfolioPositionTable key={`positions-${refreshKey}`} />
        <PortfolioReviewPanel
          key={`review-${refreshKey}`}
          onReviewComplete={() => setRefreshKey((k) => k + 1)}
        />
      </div>
    </main>
  );
}

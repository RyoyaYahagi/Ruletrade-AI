export type StockSplitAction = {
  type: "split";
  ticker: string;
  exDate: string;
  ratio: number;
  adjustmentLabel: string;
  sourceUrl: string;
};

export type StockSpinOffAction = {
  type: "spin-off";
  ticker: string;
  exDate: string;
  childTicker: string;
  childName: string;
  childStockId: string;
  childMarketCode: "JP";
  childRatio: number;
  parentBasisRatio: number;
  childBasisRatio: number;
  adjustmentLabel: string;
  childAdjustmentLabel: string;
  sourceUrl: string;
};

export type CorporateAction = StockSplitAction | StockSpinOffAction;

// Dates and ratios come from company disclosures and exchange schedules.
export const CORPORATE_ACTIONS: readonly CorporateAction[] = [
  {
    type: "split",
    ticker: "5803",
    exDate: "2026-03-30",
    ratio: 6,
    adjustmentLabel: "株式分割（1株→6株）を反映済み",
    sourceUrl: "https://www.jpx.co.jp/news/2020/20260316-01.html",
  },
  {
    type: "split",
    ticker: "5801",
    exDate: "2026-06-29",
    ratio: 10,
    adjustmentLabel: "株式分割（1株→10株）を反映済み",
    sourceUrl:
      "https://www.jpx.co.jp/markets/statistics-equities/monthly/t13vrt000001jmoi-att/17_kenri2606.pdf",
  },
  {
    type: "split",
    ticker: "9984",
    exDate: "2025-12-29",
    ratio: 4,
    adjustmentLabel: "株式分割（1株→4株）を反映済み",
    sourceUrl:
      "https://www.jpx.co.jp/markets/statistics-equities/monthly/t13vrt000000h2iz-att/17_kenri2512.pdf",
  },
  {
    type: "spin-off",
    ticker: "6758",
    exDate: "2025-09-29",
    childTicker: "8729",
    childName: "ソニーフィナンシャルグループ",
    childStockId: "corporate-action-sony-financial-8729",
    childMarketCode: "JP",
    childRatio: 1,
    parentBasisRatio: 0.794,
    childBasisRatio: 0.206,
    adjustmentLabel: "スピンオフ（取得額20.6%を子銘柄へ移転）を反映済み",
    childAdjustmentLabel: "スピンオフ（親銘柄1株につき1株）を反映済み",
    sourceUrl: "https://www.sony.com/ja/SonyInfo/IR/news/20251001_J.pdf",
  },
];

export const SONY_FINANCIAL_STOCK = {
  id: "corporate-action-sony-financial-8729",
  name: "ソニーフィナンシャルグループ",
  ticker: "8729",
  marketCode: "JP",
} as const;

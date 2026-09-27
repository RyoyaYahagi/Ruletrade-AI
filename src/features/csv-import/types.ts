export type Broker = "rakuten" | "sbi" | "nomura";
export type CsvFormat =
  | "rakuten-jp"
  | "rakuten-us"
  | "rakuten-investment-fund"
  | "sbi-jp"
  | "nomura-jp";
export type Currency = "JPY" | "USD";

export type NormalizedTransaction = {
  marketCode: "JP" | "US";
  ticker: string | null;
  stockName: string;
  side: "buy" | "sell";
  quantity: number;
  price: number | null;
  priceCurrency: Currency;
  fee: number | null;
  feeCurrency: Currency | null;
  executedAt: string;
  settlementDate: string | null;
  accountType: string | null;
  settlementCurrency: Currency | null;
  settlementAmount: number | null;
  exchangeRate: number | null;
  sourceBroker: Broker;
  sourceTradeType: string;
  sourceRowNumber: number;
};

export type ExcludedRow = {
  sourceRowNumber: number;
  stockName: string;
  sourceTradeType: string;
  reason: string;
};

export type UnknownRow = {
  sourceRowNumber: number;
  stockName: string;
  sourceTradeType: string;
  reason: string;
};

export type ParsedCsv = {
  broker: Broker;
  format: CsvFormat;
  rawCsv: string;
  rawEncoding: "utf-8" | "utf-8-bom" | "cp932";
  transactions: NormalizedTransaction[];
  excluded: ExcludedRow[];
  unknown: UnknownRow[];
};

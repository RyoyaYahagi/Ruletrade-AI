import {
  index,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const stocks = sqliteTable(
  "stocks",
  {
    id: text("id").primaryKey(),
    ticker: text("ticker"),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    market: text("market"),
    marketCode: text("market_code"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("stocks_ticker_idx").on(table.ticker)],
);

export const decisions = sqliteTable(
  "decisions",
  {
    id: text("id").primaryKey(),
    stockId: text("stock_id")
      .notNull()
      .references(() => stocks.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    rawInput: text("raw_input").notNull(),
    transcript: text("transcript"),
    followUpAnswer: text("follow_up_answer"),
    followUpQuestion: text("follow_up_question"),
    summary: text("summary"),
    points: text("points_json"),
    thesis: text("thesis"),
    assumptions: text("assumptions_json").notNull(),
    reviewConditions: text("review_conditions_json").notNull(),
    addConditions: text("add_conditions_json").notNull(),
    reviewAt: text("review_at"),
    reviewDates: text("review_dates_json"),
    editHistory: text("edit_history_json"),
    decidedAt: text("decided_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("decisions_stock_created_idx").on(table.stockId, table.createdAt),
    index("decisions_review_at_idx").on(table.reviewAt),
  ],
);

export const transactions = sqliteTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    stockId: text("stock_id")
      .notNull()
      .references(() => stocks.id, { onDelete: "cascade" }),
    side: text("side").notNull(),
    quantity: real("quantity").notNull(),
    price: real("price"),
    fee: real("fee"),
    executedAt: text("executed_at").notNull(),
    decisionId: text("decision_id").references(() => decisions.id, {
      onDelete: "set null",
    }),
    createdAt: text("created_at").notNull(),
    priceCurrency: text("price_currency"),
    feeCurrency: text("fee_currency"),
    settlementDate: text("settlement_date"),
    settlementCurrency: text("settlement_currency"),
    settlementAmount: real("settlement_amount"),
    exchangeRate: real("exchange_rate"),
    accountType: text("account_type"),
    sourceBroker: text("source_broker"),
    sourceTradeType: text("source_trade_type"),
    importBatchId: text("import_batch_id").references(() => importBatches.id, {
      onDelete: "cascade",
    }),
    sourceFingerprint: text("source_fingerprint"),
    sourceRowNumber: real("source_row_number"),
  },
  (table) => [
    index("transactions_stock_executed_idx").on(
      table.stockId,
      table.executedAt,
    ),
    index("transactions_executed_idx").on(table.executedAt),
    index("transactions_import_batch_idx").on(table.importBatchId),
    index("transactions_fingerprint_idx").on(table.sourceFingerprint),
  ],
);

export const importBatches = sqliteTable("import_batches", {
  id: text("id").primaryKey(),
  broker: text("broker").notNull(),
  format: text("format").notNull(),
  fileName: text("file_name").notNull(),
  rawCsv: text("raw_csv").notNull(),
  rawEncoding: text("raw_encoding").notNull(),
  sha256: text("sha256").notNull(),
  importedAt: text("imported_at").notNull(),
  transactionCount: real("transaction_count").notNull(),
  duplicateCount: real("duplicate_count").notNull(),
  mergedCount: real("merged_count").notNull().default(0),
  excludedCount: real("excluded_count").notNull(),
  unknownCount: real("unknown_count").notNull(),
  undoneAt: text("undone_at"),
});

export const importBatchStocks = sqliteTable("import_batch_stocks", {
  batchId: text("batch_id")
    .notNull()
    .references(() => importBatches.id, { onDelete: "cascade" }),
  stockId: text("stock_id")
    .notNull()
    .references(() => stocks.id, { onDelete: "cascade" }),
  createdByBatch: real("created_by_batch").notNull(),
});

export const transactionImportSources = sqliteTable(
  "transaction_import_sources",
  {
    id: text("id").primaryKey(),
    transactionId: text("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    importBatchId: text("import_batch_id")
      .notNull()
      .references(() => importBatches.id, { onDelete: "cascade" }),
    sourceRowNumber: real("source_row_number").notNull(),
    sourceFingerprint: text("source_fingerprint").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("import_sources_fingerprint_idx").on(table.sourceFingerprint),
    uniqueIndex("import_sources_batch_row_idx").on(
      table.importBatchId,
      table.sourceRowNumber,
    ),
  ],
);

export const importChanges = sqliteTable("import_changes", {
  id: text("id").primaryKey(),
  importBatchId: text("import_batch_id")
    .notNull()
    .references(() => importBatches.id, { onDelete: "cascade" }),
  entity: text("entity").notNull(),
  entityId: text("entity_id").notNull(),
  before: text("before_json").notNull(),
  after: text("after_json").notNull(),
});

export const reviews = sqliteTable(
  "reviews",
  {
    id: text("id").primaryKey(),
    stockId: text("stock_id")
      .notNull()
      .references(() => stocks.id, { onDelete: "cascade" }),
    decisionId: text("decision_id").references(() => decisions.id, {
      onDelete: "set null",
    }),
    currentInput: text("current_input").notNull(),
    summary: text("summary").notNull(),
    differences: text("differences_json").notNull(),
    reflection: text("reflection").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("reviews_stock_created_idx").on(table.stockId, table.createdAt),
  ],
);

export const schema = {
  stocks,
  decisions,
  transactions,
  reviews,
  importBatches,
  importBatchStocks,
  transactionImportSources,
  importChanges,
};

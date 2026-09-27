import {
  index,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const stocks = sqliteTable(
  "stocks",
  {
    id: text("id").primaryKey(),
    ticker: text("ticker"),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    market: text("market"),
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
    thesis: text("thesis"),
    assumptions: text("assumptions_json").notNull(),
    reviewConditions: text("review_conditions_json").notNull(),
    addConditions: text("add_conditions_json").notNull(),
    reviewAt: text("review_at"),
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
  },
  (table) => [
    index("transactions_stock_executed_idx").on(table.stockId, table.executedAt),
    index("transactions_executed_idx").on(table.executedAt),
  ],
);

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
  (table) => [index("reviews_stock_created_idx").on(table.stockId, table.createdAt)],
);

export const schema = { stocks, decisions, transactions, reviews };

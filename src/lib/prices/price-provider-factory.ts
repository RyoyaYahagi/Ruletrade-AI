import { AppError } from "@/lib/errors/app-error";
import { env } from "@/env";
import type { PriceProvider } from "@/lib/prices/price-provider";
import { MockPriceProvider } from "@/lib/prices/providers/mock-price-provider";
import { StooqPriceProvider } from "@/lib/prices/providers/stooq-price-provider";

export function createPriceProvider(): PriceProvider {
  if (env.PRICE_PROVIDER === "mock") return new MockPriceProvider();
  if (env.PRICE_PROVIDER === "stooq") return new StooqPriceProvider();
  throw new AppError("CONFIG_ERROR", `未知のPRICE_PROVIDER: ${env.PRICE_PROVIDER}`, 500, {});
}

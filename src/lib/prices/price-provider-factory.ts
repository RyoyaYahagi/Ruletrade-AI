import "server-only";

import { AppError } from "@/lib/errors/app-error";
import type { PriceProvider } from "@/lib/prices/price-provider";
import { MockPriceProvider } from "@/lib/prices/providers/mock-price-provider";
import { StooqPriceProvider } from "@/lib/prices/providers/stooq-price-provider";

export function createPriceProvider(): PriceProvider {
  const providerName = process.env.PRICE_PROVIDER ?? "mock";
  if (providerName === "stooq") return new StooqPriceProvider();
  if (providerName === "mock") return new MockPriceProvider();

  throw new AppError(
    "CONFIG_ERROR",
    `未知の PRICE_PROVIDER: ${providerName}`,
    500,
    {},
  );
}

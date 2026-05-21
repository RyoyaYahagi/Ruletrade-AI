import { StaticFeatureFlagProvider } from "./static-provider";
import { DbFeatureFlagProvider } from "./db-provider";
import type { FeatureFlagProvider } from "./types";

export function getFeatureFlagProvider(): FeatureFlagProvider {
  const provider = process.env.FEATURE_FLAG_PROVIDER ?? "db";

  switch (provider) {
    case "db":
      return new DbFeatureFlagProvider();
    case "static":
      return new StaticFeatureFlagProvider();
    default:
      return new DbFeatureFlagProvider();
  }
}

export { StaticFeatureFlagProvider, DbFeatureFlagProvider };
export type {
  FeatureFlagProvider,
  FeatureFlagValue,
  FeatureFlagContext,
} from "./types";

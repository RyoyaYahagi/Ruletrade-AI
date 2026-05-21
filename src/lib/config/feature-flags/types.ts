export type FeatureFlagValue =
  | boolean
  | string
  | number
  | Record<string, unknown>
  | null;

export type FeatureFlagContext = {
  userId?: string;
  email?: string;
  environment: "local" | "development" | "preview" | "production";
  role?: "user" | "admin";
  plan?: "free" | "plus" | "pro";
  experienceLevel?: "beginner" | "intermediate" | "advanced";
};

export interface FeatureFlagProvider {
  getFlag<T extends FeatureFlagValue>(
    flagKey: string,
    defaultValue: T,
    context: FeatureFlagContext,
  ): Promise<T>;
}

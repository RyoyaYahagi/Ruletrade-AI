import type { paths, components } from "@/generated/openapi-types";

export type ApiPaths = paths;
export type ApiComponents = components;

export type ApiErrorCode = components["schemas"]["ApiErrorCode"];
export type RuleSession = components["schemas"]["RuleSession"];
export type RuleReview = components["schemas"]["RuleReview"];
export type PrivacySettings = components["schemas"]["PrivacySettings"];
export type BillingPlan = components["schemas"]["BillingPlan"];
export type WatchlistItem = components["schemas"]["WatchlistItem"];

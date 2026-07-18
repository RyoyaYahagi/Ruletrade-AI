import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";
import { hashContent } from "@/lib/rag/hash-content";
import type { ThesisDraftOutput, ThesisResearchSource } from "@/schemas/rules/thesis-research-schema";

export type ThesisResearchRunStatus =
  | "running"
  | "completed"
  | "partial"
  | "failed";

export function createThesisResearchInputHash(input: unknown) {
  return hashContent(JSON.stringify(input));
}

export async function getCachedThesisResearchRun(params: {
  userId: string;
  sessionId: string;
  inputHash: string;
}) {
  const db = await createDatabaseClient();
  const { data, error } = await db
    .from("thesis_research_runs")
    .select("*")
    .eq("user_id", params.userId)
    .eq("session_id", params.sessionId)
    .eq("input_hash", params.inputHash)
    .gte("expires_at", new Date().toISOString())
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveThesisResearchRun(params: {
  id?: string;
  userId: string;
  sessionId: string;
  inputHash: string;
  status: ThesisResearchRunStatus;
  sources: ThesisResearchSource[];
  research: Record<string, unknown>;
  draft?: ThesisDraftOutput | null;
  provider?: string | null;
  model?: string | null;
  errorMessage?: string | null;
  expiresAt?: string | null;
}) {
  const db = await createDatabaseClient();
  const { data, error } = await db
    .from("thesis_research_runs")
    .upsert(
      {
        ...(params.id ? { id: params.id } : {}),
        user_id: params.userId,
        session_id: params.sessionId,
        input_hash: params.inputHash,
        status: params.status,
        sources_json: params.sources,
        research_json: params.research,
        draft_json: params.draft ?? null,
        provider: params.provider ?? null,
        model: params.model ?? null,
        error_message: params.errorMessage ?? null,
        expires_at: params.expiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
      { onConflict: "user_id,session_id,input_hash" },
    )
    .select("*")
    .single();
  if (error || !data) throw error ?? new Error("thesis research run was not saved");
  return data;
}

export function parseCachedSources(value: unknown): ThesisResearchSource[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isThesisResearchSource);
}

export function parseCachedDraft(value: unknown): ThesisDraftOutput | null {
  if (!value || typeof value !== "object") return null;
  return isThesisDraftOutput(value) ? value : null;
}

function isThesisResearchSource(value: unknown): value is ThesisResearchSource {
  if (!value || typeof value !== "object") return false;
  const source = value as Record<string, unknown>;
  return (
    typeof source.ref === "string" &&
    /^S\d+$/.test(source.ref) &&
    typeof source.title === "string" &&
    typeof source.publisher === "string" &&
    typeof source.excerpt === "string" &&
    typeof source.highlightText === "string" &&
    typeof source.verified === "boolean"
  );
}

function isThesisDraftOutput(value: unknown): value is ThesisDraftOutput {
  if (!value || typeof value !== "object") return false;
  const draft = value as Record<string, unknown>;
  return (
    typeof draft.thesis === "string" &&
    Array.isArray(draft.thesisSegments) &&
    Array.isArray(draft.evidence) &&
    typeof draft.growthDefinition === "string" &&
    Array.isArray(draft.growthIndicators) &&
    Array.isArray(draft.nearTermFactors) &&
    Array.isArray(draft.invalidationConditions) &&
    Array.isArray(draft.breakers) &&
    draft.breakers.length === 4
  );
}

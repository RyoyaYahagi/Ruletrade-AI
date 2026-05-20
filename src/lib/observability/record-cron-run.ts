import "server-only";
import { createServerClient } from "@/lib/db/supabase-server";

export interface CronRunInput {
  cronName: string;
  status: "started" | "completed" | "failed";
  startedAt: string;
  finishedAt?: string | null;
  errorMessage?: string | null;
  itemsProcessed?: number | null;
}

export async function recordCronRun(params: CronRunInput): Promise<void> {
  try {
    const supabase = await createServerClient();

    await supabase.from("cron_run_logs").insert({
      cron_name: params.cronName,
      status: params.status,
      started_at: params.startedAt,
      finished_at: params.finishedAt ?? null,
      error_message: params.errorMessage ?? null,
      items_processed: params.itemsProcessed ?? null,
    });
  } catch {
    // Cron logging must never break cron execution.
  }
}

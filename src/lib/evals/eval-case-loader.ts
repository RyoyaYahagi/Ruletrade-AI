import "server-only";

import { createServerClient } from "@/lib/db/supabase-server";

export async function loadActiveEvalCases(params: {
  taskType: string;
  tags?: string[];
}) {
  const supabase = await createServerClient();

  let query = supabase
    .from("eval_cases")
    .select("*")
    .eq("task_type", params.taskType)
    .eq("is_active", true);

  if (params.tags && params.tags.length > 0) {
    query = query.contains("tags", params.tags);
  }

  const { data, error } = await query.order("case_key", {
    ascending: true,
  });

  if (error) {
    throw error;
  }

  return data ?? [];
}

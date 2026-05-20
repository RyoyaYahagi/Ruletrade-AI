import "server-only";

import { createServerClient } from "@/lib/db/supabase-server";
import { logPrivacyAudit } from "@/features/privacy/services/privacy-audit-service";

export async function deleteUserRagMemory(params: { userId: string }) {
  const supabase = await createServerClient();

  await supabase
    .from("rag_retrieval_logs")
    .delete()
    .eq("user_id", params.userId);

  await supabase.from("embedding_jobs").delete().eq("user_id", params.userId);

  await supabase.from("rag_chunks").delete().eq("user_id", params.userId);

  await supabase.from("rag_documents").delete().eq("user_id", params.userId);

  await logPrivacyAudit({
    userId: params.userId,
    actorUserId: params.userId,
    action: "rag_memory_deleted",
    metadata: { deletionType: "rag_memory" },
  });

  return { deleted: true };
}

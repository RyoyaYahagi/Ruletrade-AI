import "server-only";

import { createServerClient } from "@/lib/db/supabase-server";
import { AppError } from "@/lib/errors/app-error";

export async function createFeedback(params: {
  userId: string;
  feedbackType: string;
  title: string;
  body: string;
}) {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("feedback_items")
    .insert({
      user_id: params.userId,
      feedback_type: params.feedbackType,
      title: params.title,
      body: params.body,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new AppError(
      "INTERNAL_ERROR",
      "Failed to create feedback.",
      500,
      error,
    );
  }

  return { feedback: data };
}

export async function listFeedback(params: { 
  userId: string;
  status?: string 
}) {
  const supabase = await createServerClient();

  let query = supabase
    .from("feedback_items")
    .select("*, feedback_votes(vote_type)")
    .eq("user_id", params.userId);

  if (params.status) {
    query = query.eq("status", params.status);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) throw error;

  return { feedbackItems: data ?? [] };
}

export async function voteFeedback(params: {
  userId: string;
  feedbackId: string;
  voteType: string;
}) {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("feedback_votes")
    .upsert(
      {
        user_id: params.userId,
        feedback_id: params.feedbackId,
        vote_type: params.voteType,
      },
      { onConflict: "user_id, feedback_id" },
    )
    .select("*")
    .single();

  if (error || !data) {
    throw new AppError(
      "INTERNAL_ERROR",
      "Failed to vote feedback.",
      500,
      error,
    );
  }

  return { vote: data };
}

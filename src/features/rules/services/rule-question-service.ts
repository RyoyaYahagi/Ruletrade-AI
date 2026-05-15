import "server-only";

import { createClient } from "@/lib/db/supabase-server";
import { AppError } from "@/lib/errors/app-error";

export async function createInitialQuestions(params: { userId: string; sessionId: string; }) {
  const supabase = await createClient();
  const questions = [
    { user_id: params.userId, session_id: params.sessionId, question_key: "investment_thesis", question_text: "この銘柄を買いたい理由は何ですか？", question_type: "free_text", help_text: "事業成長、割安感、配当、テーマ性など、今考えている理由を書いてください。", priority: 5, is_required: true, maps_to_rule_field: "investmentThesis", source: "template", display_order: 1 },
    { user_id: params.userId, session_id: params.sessionId, question_key: "time_horizon", question_text: "どれくらいの期間で考えていますか？", question_type: "single_choice", options: [{ label: "数週間〜数か月", value: "short_term" }, { label: "数か月〜1年", value: "medium_term" }, { label: "1年以上", value: "long_term" }, { label: "まだ決めていない", value: "undecided" }], priority: 4, is_required: true, maps_to_rule_field: "timeHorizon", source: "template", display_order: 2 },
    { user_id: params.userId, session_id: params.sessionId, question_key: "entry_price_range", question_text: "いくらくらいまでなら買いたいですか？", question_type: "price_range", help_text: "まだ決まっていなければ、おおまかな価格帯でも大丈夫です。", priority: 4, is_required: false, maps_to_rule_field: "entryPlan", source: "template", display_order: 3 },
  ];
  const { error } = await supabase.from("rule_questions").insert(questions);
  if (error) { throw new AppError("INTERNAL_ERROR", "質問の作成に失敗しました。", 500, error); }
}

export async function getNextQuestion(params: { userId: string; sessionId: string; }) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("rule_questions").select("*").eq("session_id", params.sessionId).eq("user_id", params.userId).eq("status", "pending").order("priority", { ascending: false }).order("display_order", { ascending: true }).limit(1).maybeSingle();
  if (error) { throw new AppError("INTERNAL_ERROR", "次の質問の取得に失敗しました。", 500, error); }
  return { question: data ?? null };
}

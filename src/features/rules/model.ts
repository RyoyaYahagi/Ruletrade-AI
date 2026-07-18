export type RuleSessionSummary = {
  id: string;
  ticker: string;
  company_name: string | null;
  status: string;
  completion_score: number;
  quality_gate_status: string;
  question_count: number;
  max_question_count: number;
  created_at: string;
  updated_at: string;
};

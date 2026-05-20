-- Data retention & restore drill tables

CREATE TABLE IF NOT EXISTS public.data_purge_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  deleted_count int NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  error_message text
);

COMMENT ON TABLE public.data_purge_log IS 'Audit log for automated data purges.';

CREATE TABLE IF NOT EXISTS public.restore_drills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_source text NOT NULL,
  restore_time_seconds int,
  smoke_test_result boolean,
  rls_check_result boolean,
  privacy_check_result boolean,
  issues_found text,
  next_improvement text,
  performed_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.restore_drills IS 'Results of quarterly restore drills.';

-- RLS: only admins can access these tables
ALTER TABLE public.data_purge_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restore_drills ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_only_data_purge_log ON public.data_purge_log
  FOR ALL USING (auth.jwt()->>'role' = 'admin');

CREATE POLICY admin_only_restore_drills ON public.restore_drills
  FOR ALL USING (auth.jwt()->>'role' = 'admin');

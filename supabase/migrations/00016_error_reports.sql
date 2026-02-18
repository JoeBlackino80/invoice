-- Error reports table for monitoring and error tracking
CREATE TABLE IF NOT EXISTS error_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_id TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  error_name TEXT NOT NULL,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  user_id UUID,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  module TEXT,
  action TEXT,
  request_path TEXT,
  request_method TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_error_reports_severity ON error_reports (severity, timestamp DESC);
CREATE INDEX idx_error_reports_company ON error_reports (company_id, timestamp DESC);
CREATE INDEX idx_error_reports_module ON error_reports (module, timestamp DESC);

-- Auto-cleanup: partition by month or delete old records
-- Keep errors for 90 days
CREATE INDEX idx_error_reports_cleanup ON error_reports (created_at);

-- RLS: only admins can view error reports
ALTER TABLE error_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view error reports" ON error_reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_company_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

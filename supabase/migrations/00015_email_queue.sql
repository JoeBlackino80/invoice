-- Email queue table for reliable email delivery with retry logic
CREATE TABLE IF NOT EXISTS email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,

  -- Email fields
  to_email TEXT NOT NULL,
  from_email TEXT,
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL,

  -- Attachments as JSON array [{filename, url}]
  attachments JSONB DEFAULT '[]'::jsonb,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  priority INTEGER NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10), -- 1 = highest

  -- Retry logic
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  last_error TEXT,
  next_retry_at TIMESTAMPTZ,

  -- Metadata
  template_type TEXT, -- invoice_send, reminder, payment_confirmation, portal_token, notification, etc.
  reference_id UUID, -- ID of related entity (invoice, payment, etc.)
  reference_type TEXT, -- invoice, payment, contact, etc.
  metadata JSONB DEFAULT '{}'::jsonb,

  -- External tracking
  resend_id TEXT, -- Resend API message ID

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,

  -- Scheduling
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for queue processing
CREATE INDEX idx_email_queue_status_priority ON email_queue (status, priority, scheduled_for) WHERE status IN ('pending', 'failed');
CREATE INDEX idx_email_queue_company ON email_queue (company_id);
CREATE INDEX idx_email_queue_reference ON email_queue (reference_type, reference_id);
CREATE INDEX idx_email_queue_next_retry ON email_queue (next_retry_at) WHERE status = 'failed' AND attempts < max_attempts;

-- RLS
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view email queue for their companies" ON email_queue
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM user_company_roles WHERE user_id = auth.uid()
    )
  );

-- Email log table for historical tracking (sent emails stay here permanently)
CREATE TABLE IF NOT EXISTS email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  queue_id UUID REFERENCES email_queue(id) ON DELETE SET NULL,

  to_email TEXT NOT NULL,
  from_email TEXT,
  subject TEXT NOT NULL,

  status TEXT NOT NULL, -- sent, failed, bounced, complained
  resend_id TEXT,

  template_type TEXT,
  reference_id UUID,
  reference_type TEXT,

  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_email_log_company ON email_log (company_id, created_at DESC);
CREATE INDEX idx_email_log_reference ON email_log (reference_type, reference_id);
CREATE INDEX idx_email_log_to ON email_log (to_email);

ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view email logs for their companies" ON email_log
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM user_company_roles WHERE user_id = auth.uid()
    )
  );

-- Updated at trigger
CREATE TRIGGER email_queue_updated_at
  BEFORE UPDATE ON email_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

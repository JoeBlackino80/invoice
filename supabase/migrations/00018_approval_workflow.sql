-- Invoice approval workflow
-- Multi-level: fakturant → účtovník → konateľ (admin)

CREATE TABLE IF NOT EXISTS invoice_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,

  -- Approval step
  step INTEGER NOT NULL DEFAULT 1, -- 1=fakturant, 2=účtovník, 3=konateľ
  step_name TEXT NOT NULL, -- 'fakturant', 'uctovnik', 'konatel'
  required_role TEXT NOT NULL, -- role that can approve this step

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'skipped')),

  -- Who actioned
  actioned_by UUID,
  actioned_at TIMESTAMPTZ,
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invoice_approvals_invoice ON invoice_approvals (invoice_id, step);
CREATE INDEX idx_invoice_approvals_company ON invoice_approvals (company_id, status);
CREATE INDEX idx_invoice_approvals_pending ON invoice_approvals (company_id, status, required_role) WHERE status = 'pending';

ALTER TABLE invoice_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view approvals for their companies" ON invoice_approvals
  FOR ALL USING (
    company_id IN (SELECT company_id FROM user_company_roles WHERE user_id = auth.uid())
  );

-- Add approval_status to invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'none'
  CHECK (approval_status IN ('none', 'pending', 'in_progress', 'approved', 'rejected'));
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS current_approval_step INTEGER DEFAULT 0;

CREATE TRIGGER invoice_approvals_updated_at
  BEFORE UPDATE ON invoice_approvals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

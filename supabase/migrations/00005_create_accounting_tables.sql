-- ============================================
-- ÚČTOVNÍCTVO
-- ============================================

-- Účtový rozvrh
CREATE TABLE chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  synth_account VARCHAR(3) NOT NULL,
  analyt_account VARCHAR(10),
  name TEXT NOT NULL,
  account_type TEXT NOT NULL, -- aktivny, pasivny, vynosovy, nakladovy
  is_tax_relevant BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_off_balance BOOLEAN NOT NULL DEFAULT false,
  parent_account_id UUID REFERENCES chart_of_accounts(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, synth_account, analyt_account)
);

CREATE INDEX idx_coa_company ON chart_of_accounts(company_id);
CREATE INDEX idx_coa_synth ON chart_of_accounts(company_id, synth_account);

-- Účtovné zápisy - hlavička
CREATE TABLE journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  entry_number TEXT NOT NULL,
  entry_type journal_entry_type NOT NULL,
  entry_date DATE NOT NULL,
  description TEXT NOT NULL,
  status journal_entry_status NOT NULL DEFAULT 'draft',
  fiscal_year_id UUID REFERENCES fiscal_years(id),
  source_invoice_id UUID REFERENCES invoices(id),
  source_document_id UUID,
  total_debit NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_credit NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT je_balance CHECK (total_debit = total_credit OR status = 'draft')
);

CREATE INDEX idx_je_company ON journal_entries(company_id);
CREATE INDEX idx_je_date ON journal_entries(company_id, entry_date);
CREATE INDEX idx_je_type ON journal_entries(company_id, entry_type);
CREATE INDEX idx_je_status ON journal_entries(company_id, status);
CREATE INDEX idx_je_fy ON journal_entries(fiscal_year_id);
CREATE INDEX idx_je_invoice ON journal_entries(source_invoice_id) WHERE source_invoice_id IS NOT NULL;

-- Účtovné zápisy - riadky
CREATE TABLE journal_entry_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
  side entry_side NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  amount_currency NUMERIC(15,2),
  currency VARCHAR(3),
  exchange_rate NUMERIC(10,6),
  cost_center_id UUID,
  project_id UUID,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_jel_entry ON journal_entry_lines(journal_entry_id);
CREATE INDEX idx_jel_account ON journal_entry_lines(account_id);
CREATE INDEX idx_jel_company ON journal_entry_lines(company_id);

-- Predkontácie
CREATE TABLE predkontacie (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  entry_type journal_entry_type,
  lines JSONB NOT NULL DEFAULT '[]',
  conditions JSONB,
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pred_company ON predkontacie(company_id);

-- Strediská
CREATE TABLE cost_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, code)
);

CREATE INDEX idx_cc_company ON cost_centers(company_id);

-- Projekty / zákazky
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  contact_id UUID REFERENCES contacts(id),
  start_date DATE,
  end_date DATE,
  budget NUMERIC(15,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, code)
);

CREATE INDEX idx_proj_company ON projects(company_id);

-- Jednoduché účtovníctvo - peňažný denník
CREATE TABLE cash_book_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  type cash_transaction_type NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  is_tax_relevant BOOLEAN NOT NULL DEFAULT true,
  description TEXT NOT NULL,
  document_number TEXT,
  source TEXT NOT NULL DEFAULT 'pokladna',
  fiscal_year_id UUID REFERENCES fiscal_years(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_cbe_company ON cash_book_entries(company_id);
CREATE INDEX idx_cbe_date ON cash_book_entries(company_id, entry_date);

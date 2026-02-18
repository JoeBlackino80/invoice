-- ============================================
-- BANKA A POKLADŇA
-- ============================================

-- Bankové účty firmy
CREATE TABLE bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  iban VARCHAR(34) NOT NULL,
  bic VARCHAR(11),
  bank_name TEXT,
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
  synth_account VARCHAR(10) NOT NULL DEFAULT '221',
  opening_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ba_company ON bank_accounts(company_id);

-- Bankové výpisy
CREATE TABLE bank_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  statement_number TEXT,
  statement_date DATE NOT NULL,
  opening_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
  closing_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
  import_format TEXT,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bs_company ON bank_statements(company_id);
CREATE INDEX idx_bs_account ON bank_statements(bank_account_id);

-- Bankové transakcie
CREATE TABLE bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  bank_statement_id UUID REFERENCES bank_statements(id) ON DELETE CASCADE,
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id),
  transaction_date DATE NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  counterparty_iban VARCHAR(34),
  counterparty_name TEXT,
  variable_symbol VARCHAR(10),
  constant_symbol VARCHAR(4),
  specific_symbol VARCHAR(10),
  message TEXT,
  status TEXT NOT NULL DEFAULT 'neparovana',
  matched_invoice_id UUID REFERENCES invoices(id),
  journal_entry_id UUID REFERENCES journal_entries(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bt_company ON bank_transactions(company_id);
CREATE INDEX idx_bt_statement ON bank_transactions(bank_statement_id);
CREATE INDEX idx_bt_account ON bank_transactions(bank_account_id);
CREATE INDEX idx_bt_vs ON bank_transactions(variable_symbol) WHERE variable_symbol IS NOT NULL;
CREATE INDEX idx_bt_status ON bank_transactions(company_id, status);
CREATE INDEX idx_bt_date ON bank_transactions(company_id, transaction_date);

-- Pravidlá párovania
CREATE TABLE bank_matching_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  conditions JSONB NOT NULL,
  account_debit TEXT,
  account_credit TEXT,
  priority INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bmr_company ON bank_matching_rules(company_id);

-- Príkazy na úhradu
CREATE TABLE payment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id),
  status TEXT NOT NULL DEFAULT 'nova',
  sepa_xml TEXT,
  items JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_po_company ON payment_orders(company_id);

-- Pokladne
CREATE TABLE cash_registers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
  synth_account VARCHAR(10) NOT NULL DEFAULT '211',
  opening_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cr_company ON cash_registers(company_id);

-- Pokladničné doklady
CREATE TABLE cash_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  cash_register_id UUID NOT NULL REFERENCES cash_registers(id),
  type cash_transaction_type NOT NULL,
  document_number TEXT NOT NULL,
  transaction_date DATE NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  description TEXT NOT NULL,
  person TEXT,
  journal_entry_id UUID REFERENCES journal_entries(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_ct_company ON cash_transactions(company_id);
CREATE INDEX idx_ct_register ON cash_transactions(cash_register_id);
CREATE INDEX idx_ct_date ON cash_transactions(company_id, transaction_date);

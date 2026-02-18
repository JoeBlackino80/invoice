-- Enums pre celý systém
CREATE TYPE business_type AS ENUM ('sro', 'as', 'szco', 'druzstvo', 'ine');
CREATE TYPE accounting_type AS ENUM ('podvojne', 'jednoduche');
CREATE TYPE size_category AS ENUM ('mikro', 'mala', 'stredna', 'velka');
CREATE TYPE user_role AS ENUM ('admin', 'uctovnik', 'fakturant', 'mzdar', 'skladnik', 'readonly');
CREATE TYPE fiscal_year_status AS ENUM ('otvoreny', 'v_zavierke', 'uzavrety');
CREATE TYPE audit_action AS ENUM ('INSERT', 'UPDATE', 'DELETE');
CREATE TYPE vat_period_type AS ENUM ('mesacne', 'stvrtrocne');
CREATE TYPE invoice_type AS ENUM ('vydana', 'prijata', 'zalohova', 'dobropis', 'proforma');
CREATE TYPE invoice_status AS ENUM ('draft', 'odoslana', 'uhradena', 'ciastocne_uhradena', 'po_splatnosti', 'stornovana');
CREATE TYPE journal_entry_type AS ENUM ('FA', 'PFA', 'ID', 'BV', 'PPD', 'VPD');
CREATE TYPE journal_entry_status AS ENUM ('draft', 'zauctovany');
CREATE TYPE entry_side AS ENUM ('MD', 'D');
CREATE TYPE contact_type AS ENUM ('odberatel', 'dodavatel', 'oba');
CREATE TYPE document_type AS ENUM ('faktura', 'blocok', 'bankovy_vypis', 'zmluva', 'ine');
CREATE TYPE cash_transaction_type AS ENUM ('prijem', 'vydaj');
CREATE TYPE asset_status AS ENUM ('aktivny', 'vyradeny');
CREATE TYPE depreciation_method AS ENUM ('rovnomerny', 'zrychleny');
CREATE TYPE stock_movement_type AS ENUM ('prijemka', 'vydajka', 'prevodka', 'inventura');
CREATE TYPE tax_return_type AS ENUM ('DPH', 'KV_DPH', 'SV', 'DPPO', 'DPFO', 'mesacny_prehlad', 'rocne_hlasenie', 'OSS', 'Intrastat');
CREATE TYPE tax_return_status AS ENUM ('draft', 'finalny', 'podany');
CREATE TYPE tax_return_variant AS ENUM ('riadne', 'opravne', 'dodatocne');
-- ============================================
-- JADRO SYSTÉMU: Companies, Users, Roles
-- ============================================

-- Firmy
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  ico VARCHAR(8) UNIQUE,
  dic VARCHAR(12),
  ic_dph VARCHAR(14),
  street TEXT,
  city TEXT,
  zip VARCHAR(10),
  country VARCHAR(2) NOT NULL DEFAULT 'SK',
  email TEXT,
  phone VARCHAR(20),
  web TEXT,
  iban VARCHAR(34),
  bic VARCHAR(11),
  bank_name TEXT,
  logo_url TEXT,
  stamp_url TEXT,
  business_type business_type NOT NULL DEFAULT 'sro',
  accounting_type accounting_type NOT NULL DEFAULT 'podvojne',
  size_category size_category NOT NULL DEFAULT 'mikro',
  is_vat_payer BOOLEAN NOT NULL DEFAULT false,
  vat_period vat_period_type,
  registration_court TEXT,
  section_insert TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_companies_ico ON companies(ico) WHERE ico IS NOT NULL;
CREATE INDEX idx_companies_deleted ON companies(deleted_at) WHERE deleted_at IS NULL;

-- Väzba user-company-role
CREATE TABLE user_company_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'readonly',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, company_id)
);

CREATE INDEX idx_ucr_user ON user_company_roles(user_id);
CREATE INDEX idx_ucr_company ON user_company_roles(company_id);
CREATE INDEX idx_ucr_default ON user_company_roles(user_id, is_default) WHERE is_default = true;

-- Nastavenia firmy
CREATE TABLE company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE UNIQUE,
  default_vat_rate NUMERIC(5,2) NOT NULL DEFAULT 23.00,
  default_currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
  default_language VARCHAR(2) NOT NULL DEFAULT 'sk',
  default_payment_days INTEGER NOT NULL DEFAULT 14,
  invoice_prefix VARCHAR(10) NOT NULL DEFAULT 'FA',
  invoice_next_number INTEGER NOT NULL DEFAULT 1,
  smtp_host TEXT,
  smtp_port INTEGER,
  smtp_user TEXT,
  smtp_password TEXT,
  smtp_from_email TEXT,
  smtp_from_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cs_company ON company_settings(company_id);

-- Účtovné obdobia
CREATE TABLE fiscal_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status fiscal_year_status NOT NULL DEFAULT 'otvoreny',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fiscal_years_dates CHECK (start_date < end_date)
);

CREATE INDEX idx_fy_company ON fiscal_years(company_id);
CREATE INDEX idx_fy_status ON fiscal_years(company_id, status);

-- Číselné rady
CREATE TABLE number_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  prefix VARCHAR(10) NOT NULL,
  current_number INTEGER NOT NULL DEFAULT 0,
  format TEXT NOT NULL DEFAULT '{prefix}{year}{number:06}',
  fiscal_year_id UUID REFERENCES fiscal_years(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, type, fiscal_year_id)
);

CREATE INDEX idx_ns_company ON number_sequences(company_id);

-- Audit log
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action audit_action NOT NULL,
  old_values JSONB,
  new_values JSONB,
  user_id UUID REFERENCES auth.users(id),
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_al_company ON audit_log(company_id);
CREATE INDEX idx_al_table ON audit_log(table_name, record_id);
CREATE INDEX idx_al_user ON audit_log(user_id);
CREATE INDEX idx_al_created ON audit_log(created_at DESC);

-- Notifikácie
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notif_user ON notifications(user_id, is_read);
CREATE INDEX idx_notif_company ON notifications(company_id);
CREATE INDEX idx_notif_created ON notifications(created_at DESC);
-- ============================================
-- KONTAKTY
-- ============================================

CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type contact_type NOT NULL DEFAULT 'odberatel',
  name TEXT NOT NULL,
  ico VARCHAR(8),
  dic VARCHAR(12),
  ic_dph VARCHAR(14),
  street TEXT,
  city TEXT,
  zip VARCHAR(10),
  country VARCHAR(2) NOT NULL DEFAULT 'SK',
  email TEXT,
  phone VARCHAR(20),
  web TEXT,
  credit_limit NUMERIC(15,2),
  payment_morality INTEGER,
  tags TEXT[],
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_contacts_company ON contacts(company_id);
CREATE INDEX idx_contacts_ico ON contacts(company_id, ico) WHERE ico IS NOT NULL;
CREATE INDEX idx_contacts_type ON contacts(company_id, type);
CREATE INDEX idx_contacts_name ON contacts(company_id, name);
CREATE INDEX idx_contacts_deleted ON contacts(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_contacts_tags ON contacts USING GIN(tags);

-- Kontaktné osoby
CREATE TABLE contact_persons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position TEXT,
  email TEXT,
  phone VARCHAR(20),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cp_contact ON contact_persons(contact_id);

-- Bankové účty kontaktov
CREATE TABLE contact_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  iban VARCHAR(34) NOT NULL,
  bic VARCHAR(11),
  bank_name TEXT,
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cba_contact ON contact_bank_accounts(contact_id);

-- Log overení kontaktov
CREATE TABLE contact_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  verification_type TEXT NOT NULL,
  result JSONB NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_cv_contact ON contact_verifications(contact_id);
-- ============================================
-- FAKTURÁCIA
-- ============================================

-- Faktúry
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type invoice_type NOT NULL DEFAULT 'vydana',
  number TEXT NOT NULL,
  variable_symbol VARCHAR(10),
  constant_symbol VARCHAR(4),
  specific_symbol VARCHAR(10),
  contact_id UUID REFERENCES contacts(id),
  -- Dodávateľ (kópia v čase vystavenia)
  supplier_name TEXT,
  supplier_ico VARCHAR(8),
  supplier_dic VARCHAR(12),
  supplier_ic_dph VARCHAR(14),
  supplier_street TEXT,
  supplier_city TEXT,
  supplier_zip VARCHAR(10),
  supplier_country VARCHAR(2),
  supplier_iban VARCHAR(34),
  supplier_bic VARCHAR(11),
  -- Odberateľ (kópia v čase vystavenia)
  customer_name TEXT,
  customer_ico VARCHAR(8),
  customer_dic VARCHAR(12),
  customer_ic_dph VARCHAR(14),
  customer_street TEXT,
  customer_city TEXT,
  customer_zip VARCHAR(10),
  customer_country VARCHAR(2),
  -- Dátumy
  issue_date DATE NOT NULL,
  delivery_date DATE NOT NULL,
  due_date DATE NOT NULL,
  -- Sumy
  subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
  vat_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  total NUMERIC(15,2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  -- Mena
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
  exchange_rate NUMERIC(10,6) DEFAULT 1,
  -- Stavy
  status invoice_status NOT NULL DEFAULT 'draft',
  -- Väzby
  parent_invoice_id UUID REFERENCES invoices(id),
  -- Špeciálne
  reverse_charge BOOLEAN NOT NULL DEFAULT false,
  reverse_charge_text TEXT,
  vat_exemption_reason TEXT,
  notes TEXT,
  internal_notes TEXT,
  -- Metadata
  pdf_url TEXT,
  sent_at TIMESTAMPTZ,
  sent_to TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_inv_company ON invoices(company_id);
CREATE INDEX idx_inv_number ON invoices(company_id, number);
CREATE INDEX idx_inv_contact ON invoices(contact_id);
CREATE INDEX idx_inv_type ON invoices(company_id, type);
CREATE INDEX idx_inv_status ON invoices(company_id, status);
CREATE INDEX idx_inv_due ON invoices(company_id, due_date) WHERE status NOT IN ('uhradena', 'stornovana');
CREATE INDEX idx_inv_issue ON invoices(company_id, issue_date);
CREATE INDEX idx_inv_parent ON invoices(parent_invoice_id) WHERE parent_invoice_id IS NOT NULL;
CREATE INDEX idx_inv_deleted ON invoices(deleted_at) WHERE deleted_at IS NULL;

-- Položky faktúr
CREATE TABLE invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL,
  quantity NUMERIC(15,4) NOT NULL DEFAULT 1,
  unit VARCHAR(20) NOT NULL DEFAULT 'ks',
  unit_price NUMERIC(15,4) NOT NULL DEFAULT 0,
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 23.00,
  subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
  vat_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  total NUMERIC(15,2) NOT NULL DEFAULT 0,
  product_id UUID,
  account_debit TEXT,
  account_credit TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ii_invoice ON invoice_items(invoice_id);
CREATE INDEX idx_ii_company ON invoice_items(company_id);

-- Úhrady faktúr
CREATE TABLE invoice_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  payment_method TEXT,
  bank_transaction_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_ip_invoice ON invoice_payments(invoice_id);
CREATE INDEX idx_ip_company ON invoice_payments(company_id);

-- Opakujúce sa faktúry
CREATE TABLE recurring_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id),
  name TEXT NOT NULL,
  interval_months INTEGER NOT NULL DEFAULT 1,
  template_data JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_generated_at TIMESTAMPTZ,
  next_generation_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_ri_company ON recurring_invoices(company_id);
CREATE INDEX idx_ri_next ON recurring_invoices(next_generation_date) WHERE is_active = true;

-- Upomienky
CREATE TABLE reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  level INTEGER NOT NULL DEFAULT 1,
  sent_at TIMESTAMPTZ,
  sent_to TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rem_invoice ON reminders(invoice_id);

-- Cenové ponuky
CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  number TEXT NOT NULL,
  contact_id UUID REFERENCES contacts(id),
  issue_date DATE NOT NULL,
  valid_until DATE NOT NULL,
  subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
  vat_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  total NUMERIC(15,2) NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  converted_invoice_id UUID REFERENCES invoices(id),
  items JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_quotes_company ON quotes(company_id);

-- Objednávky
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  number TEXT NOT NULL,
  contact_id UUID REFERENCES contacts(id),
  order_date DATE NOT NULL,
  subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
  vat_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  total NUMERIC(15,2) NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
  status TEXT NOT NULL DEFAULT 'nova',
  notes TEXT,
  converted_invoice_id UUID REFERENCES invoices(id),
  items JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_orders_company ON orders(company_id);

-- Dodacie listy
CREATE TABLE delivery_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  number TEXT NOT NULL,
  invoice_id UUID REFERENCES invoices(id),
  contact_id UUID REFERENCES contacts(id),
  delivery_date DATE NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_dn_company ON delivery_notes(company_id);
CREATE INDEX idx_dn_invoice ON delivery_notes(invoice_id);
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
-- ============================================
-- MAJETOK, SKLAD, DANE, DOKUMENTY
-- ============================================

-- Odpisové skupiny
CREATE TABLE asset_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  group_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  years INTEGER NOT NULL,
  method depreciation_method NOT NULL DEFAULT 'rovnomerny',
  coefficients JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ac_company ON asset_categories(company_id);

-- Karty majetku
CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  inventory_number TEXT NOT NULL,
  category_id UUID REFERENCES asset_categories(id),
  acquisition_date DATE NOT NULL,
  acquisition_cost NUMERIC(15,2) NOT NULL,
  accounting_residual_value NUMERIC(15,2) NOT NULL,
  tax_residual_value NUMERIC(15,2) NOT NULL,
  location TEXT,
  status asset_status NOT NULL DEFAULT 'aktivny',
  disposal_date DATE,
  disposal_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_assets_company ON assets(company_id);
CREATE INDEX idx_assets_status ON assets(company_id, status);

-- Odpisy majetku
CREATE TABLE asset_depreciations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  depreciation_date DATE NOT NULL,
  accounting_amount NUMERIC(15,2) NOT NULL,
  tax_amount NUMERIC(15,2) NOT NULL,
  accounting_residual NUMERIC(15,2) NOT NULL,
  tax_residual NUMERIC(15,2) NOT NULL,
  journal_entry_id UUID REFERENCES journal_entries(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ad_asset ON asset_depreciations(asset_id);
CREATE INDEX idx_ad_company ON asset_depreciations(company_id);

-- Pohyby majetku
CREATE TABLE asset_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL,
  movement_date DATE NOT NULL,
  amount NUMERIC(15,2),
  description TEXT,
  journal_entry_id UUID REFERENCES journal_entries(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_am_asset ON asset_movements(asset_id);

-- Sklady
CREATE TABLE warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  responsible_person TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wh_company ON warehouses(company_id);

-- Produkty
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT,
  ean VARCHAR(13),
  category TEXT,
  unit VARCHAR(20) NOT NULL DEFAULT 'ks',
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 23.00,
  purchase_price NUMERIC(15,4),
  selling_price NUMERIC(15,4),
  min_stock NUMERIC(15,4),
  max_stock NUMERIC(15,4),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_prod_company ON products(company_id);
CREATE INDEX idx_prod_sku ON products(company_id, sku) WHERE sku IS NOT NULL;
CREATE INDEX idx_prod_ean ON products(ean) WHERE ean IS NOT NULL;

-- Skladové pohyby
CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type stock_movement_type NOT NULL,
  document_number TEXT NOT NULL,
  movement_date DATE NOT NULL,
  from_warehouse_id UUID REFERENCES warehouses(id),
  to_warehouse_id UUID REFERENCES warehouses(id),
  invoice_id UUID REFERENCES invoices(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_sm_company ON stock_movements(company_id);
CREATE INDEX idx_sm_date ON stock_movements(company_id, movement_date);

-- Položky skladových pohybov
CREATE TABLE stock_movement_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  stock_movement_id UUID NOT NULL REFERENCES stock_movements(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity NUMERIC(15,4) NOT NULL,
  unit_price NUMERIC(15,4) NOT NULL DEFAULT 0,
  batch TEXT,
  serial_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_smi_movement ON stock_movement_items(stock_movement_id);
CREATE INDEX idx_smi_product ON stock_movement_items(product_id);

-- Daňové podania
CREATE TABLE tax_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type tax_return_type NOT NULL,
  variant tax_return_variant NOT NULL DEFAULT 'riadne',
  period_from DATE NOT NULL,
  period_to DATE NOT NULL,
  status tax_return_status NOT NULL DEFAULT 'draft',
  xml_content TEXT,
  xml_url TEXT,
  submitted_at TIMESTAMPTZ,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_tr_company ON tax_returns(company_id);
CREATE INDEX idx_tr_type ON tax_returns(company_id, type);
CREATE INDEX idx_tr_period ON tax_returns(company_id, period_from, period_to);

-- Riadky daňových podaní
CREATE TABLE tax_return_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tax_return_id UUID NOT NULL REFERENCES tax_returns(id) ON DELETE CASCADE,
  line_number TEXT NOT NULL,
  value NUMERIC(15,2) NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_trl_return ON tax_return_lines(tax_return_id);

-- Kurzový lístok
CREATE TABLE exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  currency VARCHAR(3) NOT NULL,
  rate_date DATE NOT NULL,
  rate NUMERIC(10,6) NOT NULL,
  source TEXT NOT NULL DEFAULT 'ECB',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(currency, rate_date, source)
);

CREATE INDEX idx_er_currency ON exchange_rates(currency, rate_date DESC);

-- Sadzby DPH
CREATE TABLE vat_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate NUMERIC(5,2) NOT NULL,
  name TEXT NOT NULL,
  valid_from DATE NOT NULL,
  valid_to DATE,
  rate_type TEXT NOT NULL DEFAULT 'zakladna',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dokumenty
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type document_type NOT NULL DEFAULT 'ine',
  mime_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size INTEGER,
  invoice_id UUID REFERENCES invoices(id),
  journal_entry_id UUID REFERENCES journal_entries(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_doc_company ON documents(company_id);
CREATE INDEX idx_doc_invoice ON documents(invoice_id) WHERE invoice_id IS NOT NULL;
CREATE INDEX idx_doc_je ON documents(journal_entry_id) WHERE journal_entry_id IS NOT NULL;

-- OCR výsledky
CREATE TABLE document_ocr_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  extracted_data JSONB NOT NULL DEFAULT '{}',
  confidence_scores JSONB NOT NULL DEFAULT '{}',
  engine TEXT NOT NULL DEFAULT 'claude',
  is_processed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ocr_document ON document_ocr_results(document_id);
-- ============================================
-- FUNKCIE A TRIGGERY
-- ============================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplikovať trigger na všetky tabuľky s updated_at
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT table_name
    FROM information_schema.columns
    WHERE column_name = 'updated_at'
      AND table_schema = 'public'
      AND table_name != 'audit_log'
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at()',
      t
    );
  END LOOP;
END;
$$;

-- Audit log funkcia
CREATE OR REPLACE FUNCTION audit_log_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_company_id UUID;
  v_old JSONB;
  v_new JSONB;
BEGIN
  -- Pokus o získanie company_id
  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
    v_company_id := OLD.company_id;
    INSERT INTO audit_log (company_id, table_name, record_id, action, old_values, user_id)
    VALUES (v_company_id, TG_TABLE_NAME, OLD.id, 'DELETE', v_old, auth.uid());
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_company_id := NEW.company_id;
    -- Uložiť len zmenené polia
    INSERT INTO audit_log (company_id, table_name, record_id, action, old_values, new_values, user_id)
    VALUES (v_company_id, TG_TABLE_NAME, NEW.id, 'UPDATE', v_old, v_new, auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    v_new := to_jsonb(NEW);
    v_company_id := NEW.company_id;
    INSERT INTO audit_log (company_id, table_name, record_id, action, new_values, user_id)
    VALUES (v_company_id, TG_TABLE_NAME, NEW.id, 'INSERT', v_new, auth.uid());
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Audit triggery na dôležité tabuľky
CREATE TRIGGER trg_audit_companies AFTER INSERT OR UPDATE OR DELETE ON companies
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
CREATE TRIGGER trg_audit_invoices AFTER INSERT OR UPDATE OR DELETE ON invoices
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
CREATE TRIGGER trg_audit_invoice_items AFTER INSERT OR UPDATE OR DELETE ON invoice_items
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
CREATE TRIGGER trg_audit_journal_entries AFTER INSERT OR UPDATE OR DELETE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
CREATE TRIGGER trg_audit_journal_entry_lines AFTER INSERT OR UPDATE OR DELETE ON journal_entry_lines
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
CREATE TRIGGER trg_audit_contacts AFTER INSERT OR UPDATE OR DELETE ON contacts
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
CREATE TRIGGER trg_audit_bank_transactions AFTER INSERT OR UPDATE OR DELETE ON bank_transactions
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
CREATE TRIGGER trg_audit_cash_transactions AFTER INSERT OR UPDATE OR DELETE ON cash_transactions
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

-- Funkcia: Generovanie ďalšieho čísla dokladu
CREATE OR REPLACE FUNCTION generate_next_number(
  p_company_id UUID,
  p_type TEXT,
  p_fiscal_year_id UUID DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
  v_seq RECORD;
  v_number INTEGER;
  v_result TEXT;
  v_year TEXT;
BEGIN
  SELECT * INTO v_seq
  FROM number_sequences
  WHERE company_id = p_company_id
    AND type = p_type
    AND (fiscal_year_id = p_fiscal_year_id OR (fiscal_year_id IS NULL AND p_fiscal_year_id IS NULL))
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Číselný rad pre typ % neexistuje', p_type;
  END IF;

  v_number := v_seq.current_number + 1;
  v_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;

  -- Nahradiť placeholdery
  v_result := v_seq.format;
  v_result := REPLACE(v_result, '{prefix}', v_seq.prefix);
  v_result := REPLACE(v_result, '{year}', v_year);
  v_result := REPLACE(v_result, '{number:06}', LPAD(v_number::TEXT, 6, '0'));
  v_result := REPLACE(v_result, '{number:04}', LPAD(v_number::TEXT, 4, '0'));
  v_result := REPLACE(v_result, '{number:03}', LPAD(v_number::TEXT, 3, '0'));

  UPDATE number_sequences
  SET current_number = v_number
  WHERE id = v_seq.id;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Funkcia: Kontrola MD = D pri účtovnom zápise
CREATE OR REPLACE FUNCTION check_journal_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_debit NUMERIC(15,2);
  v_credit NUMERIC(15,2);
  v_status journal_entry_status;
BEGIN
  SELECT status INTO v_status
  FROM journal_entries
  WHERE id = NEW.journal_entry_id;

  -- Kontrola len pri zaúčtovaní
  IF v_status = 'zauctovany' THEN
    SELECT
      COALESCE(SUM(CASE WHEN side = 'MD' THEN amount ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN side = 'D' THEN amount ELSE 0 END), 0)
    INTO v_debit, v_credit
    FROM journal_entry_lines
    WHERE journal_entry_id = NEW.journal_entry_id;

    IF v_debit != v_credit THEN
      RAISE EXCEPTION 'Účtovný zápis nie je vyvážený: MD (%) != D (%)', v_debit, v_credit;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Funkcia: Zostatok účtu k dátumu
CREATE OR REPLACE FUNCTION get_account_balance(
  p_company_id UUID,
  p_account_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS NUMERIC AS $$
DECLARE
  v_debit NUMERIC(15,2);
  v_credit NUMERIC(15,2);
BEGIN
  SELECT
    COALESCE(SUM(CASE WHEN jel.side = 'MD' THEN jel.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN jel.side = 'D' THEN jel.amount ELSE 0 END), 0)
  INTO v_debit, v_credit
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.journal_entry_id
  WHERE jel.company_id = p_company_id
    AND jel.account_id = p_account_id
    AND je.entry_date <= p_date
    AND je.status = 'zauctovany'
    AND je.deleted_at IS NULL;

  RETURN v_debit - v_credit;
END;
$$ LANGUAGE plpgsql;

-- Funkcia: Prepočet súm faktúry
CREATE OR REPLACE FUNCTION calculate_invoice_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_subtotal NUMERIC(15,2);
  v_vat NUMERIC(15,2);
  v_total NUMERIC(15,2);
BEGIN
  SELECT
    COALESCE(SUM(subtotal), 0),
    COALESCE(SUM(vat_amount), 0),
    COALESCE(SUM(total), 0)
  INTO v_subtotal, v_vat, v_total
  FROM invoice_items
  WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id);

  UPDATE invoices
  SET subtotal = v_subtotal,
      vat_amount = v_vat,
      total = v_total
  WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calc_invoice_totals
  AFTER INSERT OR UPDATE OR DELETE ON invoice_items
  FOR EACH ROW EXECUTE FUNCTION calculate_invoice_totals();

-- Funkcia: Prepočet položky faktúry pred uložením
CREATE OR REPLACE FUNCTION calculate_invoice_item()
RETURNS TRIGGER AS $$
BEGIN
  NEW.subtotal := ROUND(NEW.quantity * NEW.unit_price, 2);
  NEW.vat_amount := ROUND(NEW.subtotal * NEW.vat_rate / 100, 2);
  NEW.total := NEW.subtotal + NEW.vat_amount;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calc_invoice_item
  BEFORE INSERT OR UPDATE ON invoice_items
  FOR EACH ROW EXECUTE FUNCTION calculate_invoice_item();
-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Pomocná funkcia: získať company_ids pre aktuálneho užívateľa
CREATE OR REPLACE FUNCTION get_user_company_ids()
RETURNS SETOF UUID AS $$
  SELECT company_id
  FROM user_company_roles
  WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Pomocná funkcia: skontrolovať rolu
CREATE OR REPLACE FUNCTION has_company_role(p_company_id UUID, p_roles user_role[])
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_company_roles
    WHERE user_id = auth.uid()
      AND company_id = p_company_id
      AND role = ANY(p_roles)
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- Zapnúť RLS na všetkých tabuľkách
-- ============================================

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_company_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE number_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE predkontacie ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_book_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_matching_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_depreciations ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movement_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_return_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_ocr_results ENABLE ROW LEVEL SECURITY;

-- exchange_rates a vat_rates sú globálne – bez company_id
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE vat_rates ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies – vzor pre tabuľky s company_id
-- ============================================

-- Makro: vytvoriť štandardné CRUD policies pre tabuľku s company_id
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'company_settings', 'fiscal_years', 'number_sequences',
    'contacts', 'contact_persons', 'contact_bank_accounts', 'contact_verifications',
    'invoices', 'invoice_items', 'invoice_payments', 'recurring_invoices',
    'reminders', 'quotes', 'orders', 'delivery_notes',
    'chart_of_accounts', 'journal_entries', 'journal_entry_lines',
    'predkontacie', 'cost_centers', 'projects', 'cash_book_entries',
    'bank_accounts', 'bank_statements', 'bank_transactions',
    'bank_matching_rules', 'payment_orders',
    'cash_registers', 'cash_transactions',
    'asset_categories', 'assets', 'asset_depreciations', 'asset_movements',
    'warehouses', 'products', 'stock_movements', 'stock_movement_items',
    'tax_returns', 'tax_return_lines',
    'documents', 'document_ocr_results'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    -- SELECT: používateľ vidí dáta svojich firiem
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT USING (company_id IN (SELECT get_user_company_ids()))',
      'rls_select_' || t, t
    );
    -- INSERT: používateľ vkladá len do svojich firiem
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR INSERT WITH CHECK (company_id IN (SELECT get_user_company_ids()))',
      'rls_insert_' || t, t
    );
    -- UPDATE: používateľ upravuje len vo svojich firmách
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR UPDATE USING (company_id IN (SELECT get_user_company_ids()))',
      'rls_update_' || t, t
    );
    -- DELETE: používateľ maže len vo svojich firmách
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR DELETE USING (company_id IN (SELECT get_user_company_ids()))',
      'rls_delete_' || t, t
    );
  END LOOP;
END;
$$;

-- Companies – špeciálne pravidlá
CREATE POLICY rls_select_companies ON companies
  FOR SELECT USING (id IN (SELECT get_user_company_ids()));
CREATE POLICY rls_insert_companies ON companies
  FOR INSERT WITH CHECK (true); -- Každý prihlásený môže vytvoriť firmu
CREATE POLICY rls_update_companies ON companies
  FOR UPDATE USING (id IN (SELECT get_user_company_ids()));
CREATE POLICY rls_delete_companies ON companies
  FOR DELETE USING (
    id IN (SELECT get_user_company_ids())
    AND has_company_role(id, ARRAY['admin']::user_role[])
  );

-- User Company Roles
CREATE POLICY rls_select_ucr ON user_company_roles
  FOR SELECT USING (
    user_id = auth.uid()
    OR company_id IN (SELECT get_user_company_ids())
  );
CREATE POLICY rls_insert_ucr ON user_company_roles
  FOR INSERT WITH CHECK (
    company_id IN (SELECT get_user_company_ids())
  );
CREATE POLICY rls_update_ucr ON user_company_roles
  FOR UPDATE USING (
    company_id IN (SELECT get_user_company_ids())
    AND has_company_role(company_id, ARRAY['admin']::user_role[])
  );
CREATE POLICY rls_delete_ucr ON user_company_roles
  FOR DELETE USING (
    company_id IN (SELECT get_user_company_ids())
    AND has_company_role(company_id, ARRAY['admin']::user_role[])
  );

-- Audit log – len čítanie
CREATE POLICY rls_select_audit ON audit_log
  FOR SELECT USING (company_id IN (SELECT get_user_company_ids()));

-- Notifications
CREATE POLICY rls_select_notif ON notifications
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY rls_update_notif ON notifications
  FOR UPDATE USING (user_id = auth.uid());

-- Exchange rates a VAT rates – verejné (čítanie pre všetkých prihlásených)
CREATE POLICY rls_select_er ON exchange_rates
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY rls_select_vr ON vat_rates
  FOR SELECT USING (auth.uid() IS NOT NULL);
-- ============================================
-- SEED DATA: Prednastavené DPH sadzby
-- ============================================

INSERT INTO vat_rates (rate, name, valid_from, valid_to, rate_type) VALUES
  (23.00, 'Základná sadzba DPH', '2025-01-01', NULL, 'zakladna'),
  (19.00, 'Prvá znížená sadzba DPH', '2025-01-01', NULL, 'znizena'),
  (5.00, 'Druhá znížená sadzba DPH', '2025-01-01', NULL, 'super_znizena'),
  (0.00, 'Nulová sadzba / oslobodené', '2025-01-01', NULL, 'oslobodene');
-- Fix: audit_log_trigger fails on 'companies' table because it has 'id' not 'company_id'
-- Error: record "new" has no field "company_id"

CREATE OR REPLACE FUNCTION audit_log_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_company_id UUID;
  v_old JSONB;
  v_new JSONB;
  v_record JSONB;
BEGIN
  -- Tabuľka companies nemá company_id, má len id
  IF TG_TABLE_NAME = 'companies' THEN
    IF TG_OP = 'DELETE' THEN
      v_company_id := OLD.id;
    ELSE
      v_company_id := NEW.id;
    END IF;
  ELSE
    -- Pre ostatné tabuľky: bezpečne získať company_id cez JSONB
    IF TG_OP = 'DELETE' THEN
      v_record := to_jsonb(OLD);
    ELSE
      v_record := to_jsonb(NEW);
    END IF;
    v_company_id := (v_record->>'company_id')::UUID;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
    INSERT INTO audit_log (company_id, table_name, record_id, action, old_values, user_id)
    VALUES (v_company_id, TG_TABLE_NAME, OLD.id, 'DELETE', v_old, auth.uid());
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    INSERT INTO audit_log (company_id, table_name, record_id, action, old_values, new_values, user_id)
    VALUES (v_company_id, TG_TABLE_NAME, NEW.id, 'UPDATE', v_old, v_new, auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    v_new := to_jsonb(NEW);
    INSERT INTO audit_log (company_id, table_name, record_id, action, new_values, user_id)
    VALUES (v_company_id, TG_TABLE_NAME, NEW.id, 'INSERT', v_new, auth.uid());
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- ============================================
-- CHÝBAJÚCE TABUĽKY PRE FÁZY 8-13
-- Zamestnanci, Mzdy, Cestovné, Sklad (detail),
-- Závierka, Notifikácie, eDane, Portál, Integrácie
-- ============================================

-- ============================================
-- ZAMESTNANCI A MZDY (Fáza 8)
-- ============================================

CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  surname TEXT NOT NULL,
  date_of_birth DATE,
  rodne_cislo TEXT,
  id_number TEXT,
  address_street TEXT,
  address_city TEXT,
  address_zip TEXT,
  iban TEXT,
  health_insurance TEXT,
  sp_registration_number TEXT,
  marital_status TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_emp_company ON employees(company_id);
CREATE INDEX IF NOT EXISTS idx_emp_active ON employees(company_id, active);
CREATE INDEX IF NOT EXISTS idx_emp_deleted ON employees(deleted_at) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS employee_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  contract_type TEXT NOT NULL DEFAULT 'hpp',
  start_date DATE NOT NULL,
  end_date DATE,
  gross_salary NUMERIC(15,2) NOT NULL DEFAULT 0,
  position TEXT,
  work_hours_weekly NUMERIC(5,2) NOT NULL DEFAULT 40,
  probation_months INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ec_employee ON employee_contracts(employee_id);

CREATE TABLE IF NOT EXISTS employee_children (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  is_student BOOLEAN NOT NULL DEFAULT false,
  disability BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_ech_employee ON employee_children(employee_id);

CREATE TABLE IF NOT EXISTS payroll_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  period_month INTEGER NOT NULL,
  period_year INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  total_gross NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_net NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_employer_cost NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ,
  UNIQUE(company_id, period_month, period_year)
);

CREATE INDEX IF NOT EXISTS idx_pr_company ON payroll_runs(company_id);
CREATE INDEX IF NOT EXISTS idx_pr_period ON payroll_runs(company_id, period_year, period_month);

CREATE TABLE IF NOT EXISTS payroll_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id),
  employee_name TEXT NOT NULL,
  contract_type TEXT,
  gross_salary NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_gross NUMERIC(15,2) NOT NULL DEFAULT 0,
  net_salary NUMERIC(15,2) NOT NULL DEFAULT 0,
  surcharges JSONB NOT NULL DEFAULT '{}',
  sick_leave JSONB NOT NULL DEFAULT '{}',
  employee_insurance JSONB NOT NULL DEFAULT '{}',
  employer_insurance JSONB NOT NULL DEFAULT '{}',
  tax JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pi_run ON payroll_items(payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_pi_employee ON payroll_items(employee_id);
CREATE INDEX IF NOT EXISTS idx_pi_company ON payroll_items(company_id);

-- Payslips sú v podstate view nad payroll_items, ale kód referencuje tabuľku
CREATE TABLE IF NOT EXISTS payslips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id),
  payroll_item_id UUID REFERENCES payroll_items(id),
  period_month INTEGER NOT NULL,
  period_year INTEGER NOT NULL,
  gross_salary NUMERIC(15,2) NOT NULL DEFAULT 0,
  net_salary NUMERIC(15,2) NOT NULL DEFAULT 0,
  pdf_url TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ps_company ON payslips(company_id);
CREATE INDEX IF NOT EXISTS idx_ps_employee ON payslips(employee_id);
CREATE INDEX IF NOT EXISTS idx_ps_run ON payslips(payroll_run_id);

-- Payrolls tabuľka (referencovaná v kóde)
CREATE TABLE IF NOT EXISTS payrolls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  payroll_run_id UUID REFERENCES payroll_runs(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  period_month INTEGER NOT NULL,
  period_year INTEGER NOT NULL,
  gross_salary NUMERIC(15,2) NOT NULL DEFAULT 0,
  net_salary NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_deductions NUMERIC(15,2) NOT NULL DEFAULT 0,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payrolls_company ON payrolls(company_id);
CREATE INDEX IF NOT EXISTS idx_payrolls_employee ON payrolls(employee_id);

-- ============================================
-- CESTOVNÉ PRÍKAZY (Fáza 9)
-- ============================================

CREATE TABLE IF NOT EXISTS travel_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id),
  type TEXT NOT NULL DEFAULT 'tuzemsky',
  purpose TEXT NOT NULL,
  destination TEXT NOT NULL,
  country TEXT,
  departure_date DATE NOT NULL,
  departure_time TIME,
  arrival_date DATE NOT NULL,
  arrival_time TIME,
  transport_type TEXT,
  vehicle_plate TEXT,
  vehicle_consumption NUMERIC(8,2),
  distance_km NUMERIC(10,2),
  fuel_price NUMERIC(8,4),
  advance_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  advance_currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
  total_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_to_company ON travel_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_to_employee ON travel_orders(employee_id);
CREATE INDEX IF NOT EXISTS idx_to_status ON travel_orders(company_id, status);

CREATE TABLE IF NOT EXISTS travel_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_order_id UUID NOT NULL REFERENCES travel_orders(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  expense_type TEXT NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
  description TEXT,
  receipt_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_te_order ON travel_expenses(travel_order_id);
CREATE INDEX IF NOT EXISTS idx_te_company ON travel_expenses(company_id);

CREATE TABLE IF NOT EXISTS travel_meal_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_order_id UUID NOT NULL REFERENCES travel_orders(id) ON DELETE CASCADE,
  day_date DATE NOT NULL,
  breakfast_provided BOOLEAN NOT NULL DEFAULT false,
  lunch_provided BOOLEAN NOT NULL DEFAULT false,
  dinner_provided BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tmd_order ON travel_meal_days(travel_order_id);

CREATE TABLE IF NOT EXISTS travel_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_order_id UUID NOT NULL REFERENCES travel_orders(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  total_expenses NUMERIC(15,2) NOT NULL DEFAULT 0,
  meal_allowance NUMERIC(15,2) NOT NULL DEFAULT 0,
  vehicle_compensation NUMERIC(15,2) NOT NULL DEFAULT 0,
  accommodation NUMERIC(15,2) NOT NULL DEFAULT 0,
  other_expenses NUMERIC(15,2) NOT NULL DEFAULT 0,
  advance_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  difference NUMERIC(15,2) NOT NULL DEFAULT 0,
  settlement_date DATE,
  journal_entry_id UUID REFERENCES journal_entries(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_ts_order ON travel_settlements(travel_order_id);
CREATE INDEX IF NOT EXISTS idx_ts_company ON travel_settlements(company_id);

-- ============================================
-- SKLAD - DETAILNÉ TABUĽKY (Fáza 10)
-- ============================================

-- warehouse_products - oddelená od products (tá existuje v migration 7)
CREATE TABLE IF NOT EXISTS warehouse_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT,
  description TEXT,
  unit VARCHAR(20) NOT NULL DEFAULT 'ks',
  category_id UUID,
  min_stock NUMERIC(15,4),
  max_stock NUMERIC(15,4),
  ean_code TEXT,
  purchase_price NUMERIC(15,4),
  sale_price NUMERIC(15,4),
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 23.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_wp_company ON warehouse_products(company_id);
CREATE INDEX IF NOT EXISTS idx_wp_sku ON warehouse_products(company_id, sku) WHERE sku IS NOT NULL;

-- Skladové stavy na úrovni skladu
CREATE TABLE IF NOT EXISTS warehouse_stock_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  quantity NUMERIC(15,4) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(warehouse_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_wsl_warehouse ON warehouse_stock_levels(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_wsl_product ON warehouse_stock_levels(product_id);

-- Celkové skladové stavy
CREATE TABLE IF NOT EXISTS warehouse_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  quantity NUMERIC(15,4) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(warehouse_id, product_id)
);

-- Príjemky
CREATE TABLE IF NOT EXISTS stock_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  supplier_id UUID REFERENCES contacts(id),
  receipt_number TEXT NOT NULL,
  receipt_date DATE NOT NULL,
  note TEXT,
  total_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sr_company ON stock_receipts(company_id);
CREATE INDEX IF NOT EXISTS idx_sr_warehouse ON stock_receipts(warehouse_id);

CREATE TABLE IF NOT EXISTS stock_receipt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL REFERENCES stock_receipts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  quantity NUMERIC(15,4) NOT NULL,
  unit_price NUMERIC(15,4) NOT NULL DEFAULT 0,
  total_price NUMERIC(15,2) NOT NULL DEFAULT 0,
  batch_number TEXT,
  serial_number TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sri_receipt ON stock_receipt_items(receipt_id);
CREATE INDEX IF NOT EXISTS idx_sri_product ON stock_receipt_items(product_id);

-- Výdajky
CREATE TABLE IF NOT EXISTS stock_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  customer_id UUID REFERENCES contacts(id),
  issue_number TEXT NOT NULL,
  issue_date DATE NOT NULL,
  note TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_si_company ON stock_issues(company_id);
CREATE INDEX IF NOT EXISTS idx_si_warehouse ON stock_issues(warehouse_id);

CREATE TABLE IF NOT EXISTS stock_issue_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES stock_issues(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  quantity NUMERIC(15,4) NOT NULL,
  unit_price NUMERIC(15,4) NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sii_issue ON stock_issue_items(issue_id);
CREATE INDEX IF NOT EXISTS idx_sii_product ON stock_issue_items(product_id);

-- Prevodky
CREATE TABLE IF NOT EXISTS stock_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  from_warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  to_warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  transfer_number TEXT NOT NULL,
  transfer_date DATE NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_st_company ON stock_transfers(company_id);

CREATE TABLE IF NOT EXISTS stock_transfer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  quantity NUMERIC(15,4) NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sti_transfer ON stock_transfer_items(transfer_id);

-- Inventúry
CREATE TABLE IF NOT EXISTS warehouse_inventories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  inventory_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  total_differences NUMERIC(15,4) NOT NULL DEFAULT 0,
  total_value_difference NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_wi_company ON warehouse_inventories(company_id);
CREATE INDEX IF NOT EXISTS idx_wi_warehouse ON warehouse_inventories(warehouse_id);

CREATE TABLE IF NOT EXISTS warehouse_inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID NOT NULL REFERENCES warehouse_inventories(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  expected_quantity NUMERIC(15,4) NOT NULL DEFAULT 0,
  actual_quantity NUMERIC(15,4) NOT NULL DEFAULT 0,
  difference NUMERIC(15,4) NOT NULL DEFAULT 0,
  unit_price NUMERIC(15,4) NOT NULL DEFAULT 0,
  value_difference NUMERIC(15,2) NOT NULL DEFAULT 0,
  type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wii_inventory ON warehouse_inventory_items(inventory_id);
CREATE INDEX IF NOT EXISTS idx_wii_product ON warehouse_inventory_items(product_id);

-- Cenové hladiny
CREATE TABLE IF NOT EXISTS price_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  discount_percent NUMERIC(5,2),
  markup_percent NUMERIC(5,2),
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pl_company ON price_levels(company_id);

-- ============================================
-- ZÁVIERKA (Fáza 11 - closing)
-- ============================================

CREATE TABLE IF NOT EXISTS closing_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  fiscal_year_id UUID NOT NULL REFERENCES fiscal_years(id),
  item_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ,
  UNIQUE(company_id, fiscal_year_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_cc_company_fy ON closing_checklist(company_id, fiscal_year_id);

CREATE TABLE IF NOT EXISTS closing_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  fiscal_year_id UUID NOT NULL REFERENCES fiscal_years(id),
  type TEXT NOT NULL,
  journal_entry_id UUID REFERENCES journal_entries(id),
  total_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  accounts_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_co_company_fy ON closing_operations(company_id, fiscal_year_id);

CREATE TABLE IF NOT EXISTS closing_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  fiscal_year_id UUID NOT NULL REFERENCES fiscal_years(id),
  section TEXT NOT NULL,
  content TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_cn_company_fy ON closing_notes(company_id, fiscal_year_id);

CREATE TABLE IF NOT EXISTS period_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  locked BOOLEAN NOT NULL DEFAULT false,
  locked_at TIMESTAMPTZ,
  locked_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ,
  UNIQUE(company_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_pl_company ON period_locks(company_id);

-- Počiatočné stavy (opening balances) - referenced in closing module
CREATE TABLE IF NOT EXISTS opening_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  fiscal_year_id UUID NOT NULL REFERENCES fiscal_years(id),
  account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
  debit NUMERIC(15,2) NOT NULL DEFAULT 0,
  credit NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, fiscal_year_id, account_id)
);

CREATE INDEX IF NOT EXISTS idx_ob_company_fy ON opening_balances(company_id, fiscal_year_id);

-- ============================================
-- NOTIFIKÁCIE A NASTAVENIA (Fáza 12)
-- ============================================

CREATE TABLE IF NOT EXISTS notification_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  channels JSONB NOT NULL DEFAULT '["in_app"]',
  timing JSONB NOT NULL DEFAULT '{}',
  recipients JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nr_company ON notification_rules(company_id);

CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_et_company ON email_templates(company_id);

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key TEXT NOT NULL UNIQUE,
  permissions JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ak_company ON api_keys(company_id);
CREATE INDEX IF NOT EXISTS idx_ak_key ON api_keys(key);

CREATE TABLE IF NOT EXISTS archive_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  archived_data JSONB NOT NULL,
  retention_until DATE,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_ar_company ON archive_records(company_id);
CREATE INDEX IF NOT EXISTS idx_ar_table ON archive_records(table_name, record_id);

CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  language VARCHAR(2) NOT NULL DEFAULT 'sk',
  theme TEXT NOT NULL DEFAULT 'system',
  notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  email_notifications BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS document_numbering (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  prefix TEXT NOT NULL DEFAULT '',
  suffix TEXT,
  next_number INTEGER NOT NULL DEFAULT 1,
  padding INTEGER NOT NULL DEFAULT 6,
  separator TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, document_type)
);

CREATE INDEX IF NOT EXISTS idx_dn_company ON document_numbering(company_id);

-- ============================================
-- eDANE, eKASA, PORTÁL (Fáza 13)
-- ============================================

CREATE TABLE IF NOT EXISTS edane_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  period TEXT NOT NULL,
  xml_content TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  submitted_at TIMESTAMPTZ,
  response_message TEXT,
  reference_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_es_company ON edane_submissions(company_id);
CREATE INDEX IF NOT EXISTS idx_es_type ON edane_submissions(company_id, type);

CREATE TABLE IF NOT EXISTS ekasa_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_receipts INTEGER NOT NULL DEFAULT 0,
  total_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_vat NUMERIC(15,2) NOT NULL DEFAULT 0,
  receipts_data JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_eki_company ON ekasa_imports(company_id);

CREATE TABLE IF NOT EXISTS portal_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pt_token ON portal_tokens(token);
CREATE INDEX IF NOT EXISTS idx_pt_contact ON portal_tokens(contact_id);

CREATE TABLE IF NOT EXISTS payment_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE UNIQUE,
  stripe_enabled BOOLEAN NOT NULL DEFAULT false,
  stripe_key TEXT,
  gopay_enabled BOOLEAN NOT NULL DEFAULT false,
  gopay_id TEXT,
  gopay_key TEXT,
  pay_by_square_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pms_company ON payment_settings(company_id);

-- ============================================
-- INTEGRÁCIE (Fáza 13)
-- ============================================

CREATE TABLE IF NOT EXISTS webhook_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  events JSONB NOT NULL DEFAULT '[]',
  secret TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_wc_company ON webhook_configs(company_id);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_config_id UUID NOT NULL REFERENCES webhook_configs(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  payload JSONB NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  success BOOLEAN NOT NULL DEFAULT false,
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wd_config ON webhook_deliveries(webhook_config_id);
CREATE INDEX IF NOT EXISTS idx_wd_delivered ON webhook_deliveries(delivered_at DESC);

-- cash_register_entries (alias pre cash_transactions, niektoré časti kódu referencujú)
CREATE TABLE IF NOT EXISTS cash_register_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  cash_register_id UUID NOT NULL REFERENCES cash_registers(id),
  type cash_transaction_type NOT NULL,
  document_number TEXT NOT NULL,
  entry_date DATE NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  description TEXT NOT NULL,
  person TEXT,
  invoice_id UUID REFERENCES invoices(id),
  journal_entry_id UUID REFERENCES journal_entries(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cre_company ON cash_register_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_cre_register ON cash_register_entries(cash_register_id);

-- ============================================
-- UPDATED_AT TRIGGERY PRE NOVÉ TABUĽKY
-- ============================================

DO $$
DECLARE
  t TEXT;
  tables_to_update TEXT[] := ARRAY[
    'employees', 'employee_contracts', 'employee_children',
    'payroll_runs', 'payroll_items', 'payslips', 'payrolls',
    'travel_orders', 'travel_expenses', 'travel_settlements',
    'warehouse_products', 'warehouse_stock_levels', 'warehouse_stock',
    'stock_receipts', 'stock_receipt_items', 'stock_issues', 'stock_issue_items',
    'stock_transfers', 'stock_transfer_items',
    'warehouse_inventories', 'warehouse_inventory_items',
    'price_levels',
    'closing_checklist', 'closing_operations', 'closing_notes', 'period_locks',
    'opening_balances',
    'notification_rules', 'email_templates',
    'document_numbering',
    'edane_submissions', 'payment_settings',
    'webhook_configs',
    'cash_register_entries',
    'user_settings'
  ];
BEGIN
  FOREACH t IN ARRAY tables_to_update
  LOOP
    BEGIN
      EXECUTE format(
        'CREATE TRIGGER trg_updated_at_%I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at()',
        t, t
      );
    EXCEPTION WHEN duplicate_object THEN
      NULL; -- Trigger already exists
    END;
  END LOOP;
END;
$$;

-- ============================================
-- RLS PRE NOVÉ TABUĽKY S COMPANY_ID
-- ============================================

-- Tabuľky S company_id -> štandardné RLS
DO $$
DECLARE
  t TEXT;
  tables_with_company TEXT[] := ARRAY[
    'employees',
    'payroll_runs', 'payroll_items', 'payslips', 'payrolls',
    'travel_orders', 'travel_expenses', 'travel_settlements',
    'warehouse_products', 'stock_receipts',
    'stock_issues', 'stock_transfers',
    'warehouse_inventories',
    'price_levels',
    'closing_checklist', 'closing_operations', 'closing_notes', 'period_locks',
    'opening_balances',
    'notification_rules', 'email_templates', 'api_keys', 'archive_records',
    'document_numbering',
    'edane_submissions', 'ekasa_imports', 'portal_tokens', 'payment_settings',
    'webhook_configs',
    'cash_register_entries'
  ];
BEGIN
  FOREACH t IN ARRAY tables_with_company
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);

    -- SELECT
    EXECUTE format(
      'CREATE POLICY rls_select_%I ON %I FOR SELECT USING (company_id IN (SELECT get_user_company_ids()))',
      t, t
    );
    -- INSERT
    EXECUTE format(
      'CREATE POLICY rls_insert_%I ON %I FOR INSERT WITH CHECK (company_id IN (SELECT get_user_company_ids()))',
      t, t
    );
    -- UPDATE
    EXECUTE format(
      'CREATE POLICY rls_update_%I ON %I FOR UPDATE USING (company_id IN (SELECT get_user_company_ids()))',
      t, t
    );
    -- DELETE
    EXECUTE format(
      'CREATE POLICY rls_delete_%I ON %I FOR DELETE USING (company_id IN (SELECT get_user_company_ids()))',
      t, t
    );
  END LOOP;
END;
$$;

-- Špeciálne RLS pre tabuľky BEZ company_id (child tabuľky s FK na parent)

-- employee_contracts (cez employees.company_id)
ALTER TABLE employee_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_select_employee_contracts ON employee_contracts
  FOR SELECT USING (employee_id IN (SELECT id FROM employees WHERE company_id IN (SELECT get_user_company_ids())));
CREATE POLICY rls_insert_employee_contracts ON employee_contracts
  FOR INSERT WITH CHECK (employee_id IN (SELECT id FROM employees WHERE company_id IN (SELECT get_user_company_ids())));
CREATE POLICY rls_update_employee_contracts ON employee_contracts
  FOR UPDATE USING (employee_id IN (SELECT id FROM employees WHERE company_id IN (SELECT get_user_company_ids())));
CREATE POLICY rls_delete_employee_contracts ON employee_contracts
  FOR DELETE USING (employee_id IN (SELECT id FROM employees WHERE company_id IN (SELECT get_user_company_ids())));

-- employee_children (cez employees.company_id)
ALTER TABLE employee_children ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_select_employee_children ON employee_children
  FOR SELECT USING (employee_id IN (SELECT id FROM employees WHERE company_id IN (SELECT get_user_company_ids())));
CREATE POLICY rls_insert_employee_children ON employee_children
  FOR INSERT WITH CHECK (employee_id IN (SELECT id FROM employees WHERE company_id IN (SELECT get_user_company_ids())));
CREATE POLICY rls_update_employee_children ON employee_children
  FOR UPDATE USING (employee_id IN (SELECT id FROM employees WHERE company_id IN (SELECT get_user_company_ids())));

-- stock_receipt_items (cez stock_receipts.company_id)
ALTER TABLE stock_receipt_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_select_sri ON stock_receipt_items
  FOR SELECT USING (receipt_id IN (SELECT id FROM stock_receipts WHERE company_id IN (SELECT get_user_company_ids())));
CREATE POLICY rls_insert_sri ON stock_receipt_items
  FOR INSERT WITH CHECK (receipt_id IN (SELECT id FROM stock_receipts WHERE company_id IN (SELECT get_user_company_ids())));

-- stock_issue_items (cez stock_issues.company_id)
ALTER TABLE stock_issue_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_select_sii ON stock_issue_items
  FOR SELECT USING (issue_id IN (SELECT id FROM stock_issues WHERE company_id IN (SELECT get_user_company_ids())));
CREATE POLICY rls_insert_sii ON stock_issue_items
  FOR INSERT WITH CHECK (issue_id IN (SELECT id FROM stock_issues WHERE company_id IN (SELECT get_user_company_ids())));

-- stock_transfer_items (cez stock_transfers.company_id)
ALTER TABLE stock_transfer_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_select_sti ON stock_transfer_items
  FOR SELECT USING (transfer_id IN (SELECT id FROM stock_transfers WHERE company_id IN (SELECT get_user_company_ids())));
CREATE POLICY rls_insert_sti ON stock_transfer_items
  FOR INSERT WITH CHECK (transfer_id IN (SELECT id FROM stock_transfers WHERE company_id IN (SELECT get_user_company_ids())));

-- warehouse_inventory_items (cez warehouse_inventories.company_id)
ALTER TABLE warehouse_inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_select_wii ON warehouse_inventory_items
  FOR SELECT USING (inventory_id IN (SELECT id FROM warehouse_inventories WHERE company_id IN (SELECT get_user_company_ids())));
CREATE POLICY rls_insert_wii ON warehouse_inventory_items
  FOR INSERT WITH CHECK (inventory_id IN (SELECT id FROM warehouse_inventories WHERE company_id IN (SELECT get_user_company_ids())));

-- Špeciálne RLS pre user_settings (používa user_id namiesto company_id)
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_select_user_settings ON user_settings FOR SELECT USING (user_id = auth.uid());
CREATE POLICY rls_insert_user_settings ON user_settings FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY rls_update_user_settings ON user_settings FOR UPDATE USING (user_id = auth.uid());

-- Špeciálne RLS pre webhook_deliveries (cez webhook_configs)
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_select_webhook_deliveries ON webhook_deliveries
  FOR SELECT USING (
    webhook_config_id IN (
      SELECT id FROM webhook_configs WHERE company_id IN (SELECT get_user_company_ids())
    )
  );

-- Špeciálne RLS pre warehouse_stock_levels a warehouse_stock (cez warehouses)
ALTER TABLE warehouse_stock_levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_select_wsl ON warehouse_stock_levels
  FOR SELECT USING (
    warehouse_id IN (SELECT id FROM warehouses WHERE company_id IN (SELECT get_user_company_ids()))
  );
CREATE POLICY rls_insert_wsl ON warehouse_stock_levels
  FOR INSERT WITH CHECK (
    warehouse_id IN (SELECT id FROM warehouses WHERE company_id IN (SELECT get_user_company_ids()))
  );
CREATE POLICY rls_update_wsl ON warehouse_stock_levels
  FOR UPDATE USING (
    warehouse_id IN (SELECT id FROM warehouses WHERE company_id IN (SELECT get_user_company_ids()))
  );

ALTER TABLE warehouse_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_select_ws ON warehouse_stock
  FOR SELECT USING (
    warehouse_id IN (SELECT id FROM warehouses WHERE company_id IN (SELECT get_user_company_ids()))
  );
CREATE POLICY rls_insert_ws ON warehouse_stock
  FOR INSERT WITH CHECK (
    warehouse_id IN (SELECT id FROM warehouses WHERE company_id IN (SELECT get_user_company_ids()))
  );
CREATE POLICY rls_update_ws ON warehouse_stock
  FOR UPDATE USING (
    warehouse_id IN (SELECT id FROM warehouses WHERE company_id IN (SELECT get_user_company_ids()))
  );

-- Špeciálne RLS pre travel_meal_days (cez travel_orders)
ALTER TABLE travel_meal_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_select_tmd ON travel_meal_days
  FOR SELECT USING (
    travel_order_id IN (SELECT id FROM travel_orders WHERE company_id IN (SELECT get_user_company_ids()))
  );
CREATE POLICY rls_insert_tmd ON travel_meal_days
  FOR INSERT WITH CHECK (
    travel_order_id IN (SELECT id FROM travel_orders WHERE company_id IN (SELECT get_user_company_ids()))
  );

-- ============================================
-- AUDIT TRIGGERY PRE DÔLEŽITÉ NOVÉ TABUĽKY
-- ============================================

CREATE TRIGGER trg_audit_employees AFTER INSERT OR UPDATE OR DELETE ON employees
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
CREATE TRIGGER trg_audit_payroll_runs AFTER INSERT OR UPDATE OR DELETE ON payroll_runs
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
CREATE TRIGGER trg_audit_travel_orders AFTER INSERT OR UPDATE OR DELETE ON travel_orders
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
CREATE TRIGGER trg_audit_stock_receipts AFTER INSERT OR UPDATE OR DELETE ON stock_receipts
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
CREATE TRIGGER trg_audit_stock_issues AFTER INSERT OR UPDATE OR DELETE ON stock_issues
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

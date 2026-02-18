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

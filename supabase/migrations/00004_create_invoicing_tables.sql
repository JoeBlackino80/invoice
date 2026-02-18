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

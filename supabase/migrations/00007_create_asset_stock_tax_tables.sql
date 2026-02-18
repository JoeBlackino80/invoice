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

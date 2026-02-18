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

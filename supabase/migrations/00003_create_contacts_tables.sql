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

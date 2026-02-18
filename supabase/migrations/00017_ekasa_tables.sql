-- eKasa system tables
-- Full integration with Slovak electronic cash register system (Zákon č. 289/2008 Z.z.)

-- eKasa device/pokladnica registration
CREATE TABLE IF NOT EXISTS ekasa_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Device identification
  dic TEXT NOT NULL, -- DIČ prevádzkovateľa
  cash_register_code TEXT NOT NULL, -- kód pokladnice (DKP)
  serial_number TEXT, -- výrobné číslo
  device_type TEXT NOT NULL DEFAULT 'online' CHECK (device_type IN ('online', 'virtual', 'portable')),

  -- Location
  location_name TEXT NOT NULL, -- názov prevádzky
  location_address TEXT, -- adresa prevádzky

  -- Certificate for signing
  certificate_subject TEXT, -- CN z certifikátu
  certificate_serial TEXT, -- sériové číslo certifikátu
  certificate_valid_until TIMESTAMPTZ,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  registered_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_ekasa_devices_company ON ekasa_devices (company_id);
CREATE INDEX idx_ekasa_devices_dic ON ekasa_devices (dic);

-- eKasa receipts (doklady)
CREATE TABLE IF NOT EXISTS ekasa_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  device_id UUID REFERENCES ekasa_devices(id) ON DELETE SET NULL,
  cash_register_id UUID, -- reference to cash_registers table

  -- Receipt identification
  receipt_number TEXT NOT NULL,
  uid TEXT, -- UID (unikátny identifikátor dokladu) from eKasa server
  okp TEXT, -- OKP (overovací kód podnikateľa) - locally generated
  pkp TEXT, -- PKP (podpisový kód podnikateľa) - signed

  -- Receipt type
  receipt_type TEXT NOT NULL DEFAULT 'sale' CHECK (receipt_type IN (
    'sale',      -- pokladničný doklad (predaj)
    'refund',    -- doklad o vrátení (storno/vrátenie)
    'deposit',   -- doklad o vklade
    'withdrawal' -- doklad o výbere
  )),

  -- Amounts
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  vat_base_23 NUMERIC(12,2) DEFAULT 0,
  vat_amount_23 NUMERIC(12,2) DEFAULT 0,
  vat_base_19 NUMERIC(12,2) DEFAULT 0,
  vat_amount_19 NUMERIC(12,2) DEFAULT 0,
  vat_base_5 NUMERIC(12,2) DEFAULT 0,
  vat_amount_5 NUMERIC(12,2) DEFAULT 0,
  vat_base_0 NUMERIC(12,2) DEFAULT 0, -- oslobodené od DPH

  -- Payment
  payment_method TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash', 'card', 'transfer', 'voucher', 'other')),
  cash_received NUMERIC(12,2),
  change_amount NUMERIC(12,2),

  -- Items stored as JSONB
  items JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Customer (optional, for invoiced receipts)
  customer_name TEXT,
  customer_ico TEXT,
  customer_dic TEXT,
  customer_ic_dph TEXT,

  -- Status and sync
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',     -- waiting to be sent to eKasa
    'sent',        -- sent to eKasa, waiting for response
    'confirmed',   -- confirmed by eKasa (UID received)
    'offline',     -- stored offline, will be sent later
    'error',       -- error during send
    'cancelled'    -- stornovaný
  )),
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,

  -- Linked entities
  invoice_id UUID, -- if receipt is from invoice
  journal_entry_id UUID, -- accounting entry

  -- Timestamps
  receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
  receipt_time TIME NOT NULL DEFAULT CURRENT_TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ekasa_receipts_company ON ekasa_receipts (company_id, receipt_date DESC);
CREATE INDEX idx_ekasa_receipts_device ON ekasa_receipts (device_id, receipt_date DESC);
CREATE INDEX idx_ekasa_receipts_status ON ekasa_receipts (status) WHERE status IN ('pending', 'offline', 'error');
CREATE INDEX idx_ekasa_receipts_uid ON ekasa_receipts (uid) WHERE uid IS NOT NULL;
CREATE INDEX idx_ekasa_receipts_number ON ekasa_receipts (company_id, receipt_number);

-- eKasa daily closings (denné uzávierky)
CREATE TABLE IF NOT EXISTS ekasa_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  device_id UUID REFERENCES ekasa_devices(id) ON DELETE SET NULL,

  date DATE NOT NULL,
  total_receipts INTEGER NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_vat NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Breakdown
  total_cash NUMERIC(12,2) DEFAULT 0,
  total_card NUMERIC(12,2) DEFAULT 0,
  total_refunds NUMERIC(12,2) DEFAULT 0,
  receipt_count_sale INTEGER DEFAULT 0,
  receipt_count_refund INTEGER DEFAULT 0,

  -- Raw data
  receipts_data JSONB DEFAULT '[]'::jsonb,

  -- Status
  is_reconciled BOOLEAN DEFAULT false,
  reconciled_at TIMESTAMPTZ,
  journal_entry_id UUID,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,

  UNIQUE(company_id, device_id, date)
);

CREATE INDEX idx_ekasa_imports_company ON ekasa_imports (company_id, date DESC);

-- RLS policies
ALTER TABLE ekasa_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE ekasa_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ekasa_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view ekasa devices for their companies" ON ekasa_devices
  FOR ALL USING (
    company_id IN (SELECT company_id FROM user_company_roles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can manage ekasa receipts for their companies" ON ekasa_receipts
  FOR ALL USING (
    company_id IN (SELECT company_id FROM user_company_roles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can manage ekasa imports for their companies" ON ekasa_imports
  FOR ALL USING (
    company_id IN (SELECT company_id FROM user_company_roles WHERE user_id = auth.uid())
  );

-- Triggers
CREATE TRIGGER ekasa_devices_updated_at
  BEFORE UPDATE ON ekasa_devices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER ekasa_receipts_updated_at
  BEFORE UPDATE ON ekasa_receipts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

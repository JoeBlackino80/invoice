-- Migration: Add features for reminders, warehouse auto-issue, and defaults
-- Date: 2026-02-17

-- Reminder settings na company_settings
ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS reminder_days_level1 INTEGER NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS reminder_days_level2 INTEGER NOT NULL DEFAULT 14,
  ADD COLUMN IF NOT EXISTS reminder_days_level3 INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS reminders_enabled BOOLEAN NOT NULL DEFAULT true;

-- Default warehouse pre auto-výdajky
ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS default_warehouse_id UUID REFERENCES warehouses(id);

-- Invoice reference na stock_issues pre sledovanie auto-vydajok
ALTER TABLE stock_issues
  ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES invoices(id);

-- Index pre rýchle vyhľadávanie stock issues podľa faktúry
CREATE INDEX IF NOT EXISTS idx_stock_issues_invoice_id ON stock_issues(invoice_id) WHERE invoice_id IS NOT NULL;

-- Index pre rýchle vyhľadávanie reminders podľa faktúry
CREATE INDEX IF NOT EXISTS idx_reminders_invoice_id ON reminders(invoice_id);

-- Index pre period_locks vyhľadávanie
CREATE INDEX IF NOT EXISTS idx_period_locks_company_dates ON period_locks(company_id, period_start, period_end) WHERE deleted_at IS NULL;

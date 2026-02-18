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

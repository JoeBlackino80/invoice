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

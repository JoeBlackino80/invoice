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

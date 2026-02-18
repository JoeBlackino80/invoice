-- ============================================
-- SEED DATA: Prednastavené DPH sadzby
-- ============================================

INSERT INTO vat_rates (rate, name, valid_from, valid_to, rate_type) VALUES
  (23.00, 'Základná sadzba DPH', '2025-01-01', NULL, 'zakladna'),
  (19.00, 'Prvá znížená sadzba DPH', '2025-01-01', NULL, 'znizena'),
  (5.00, 'Druhá znížená sadzba DPH', '2025-01-01', NULL, 'super_znizena'),
  (0.00, 'Nulová sadzba / oslobodené', '2025-01-01', NULL, 'oslobodene');

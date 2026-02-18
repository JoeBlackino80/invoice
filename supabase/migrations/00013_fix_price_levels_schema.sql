-- Fix price_levels table: add type and percentage columns to match API
-- The API uses type ('margin'|'markup') and percentage, while the original
-- schema used discount_percent and markup_percent separately.

ALTER TABLE price_levels ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'markup';
ALTER TABLE price_levels ADD COLUMN IF NOT EXISTS percentage NUMERIC(5,2) DEFAULT 0;
ALTER TABLE price_levels ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Migrate existing data: if markup_percent is set, use it as percentage with type 'markup'
-- If discount_percent is set, use it as percentage with type 'margin'
UPDATE price_levels
SET type = CASE
    WHEN markup_percent IS NOT NULL AND markup_percent > 0 THEN 'markup'
    WHEN discount_percent IS NOT NULL AND discount_percent > 0 THEN 'margin'
    ELSE 'markup'
  END,
  percentage = COALESCE(
    CASE
      WHEN markup_percent IS NOT NULL AND markup_percent > 0 THEN markup_percent
      WHEN discount_percent IS NOT NULL AND discount_percent > 0 THEN discount_percent
      ELSE 0
    END, 0
  )
WHERE type = 'markup' AND percentage = 0;

-- Modify foods table to support user-scoped custom foods
ALTER TABLE foods ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update the source CHECK constraint to include 'CUSTOM'
ALTER TABLE foods DROP CONSTRAINT IF EXISTS foods_source_check;
ALTER TABLE foods ADD CONSTRAINT foods_source_check CHECK (source IN ('SYSTEM', 'USDA', 'OPEN_FOOD_FACTS', 'CUSTOM'));

-- Update RLS for foods
DROP POLICY IF EXISTS "select_foods" ON foods;
CREATE POLICY "select_foods" ON foods FOR SELECT
  TO authenticated USING (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "insert_custom_foods" ON foods;
CREATE POLICY "insert_custom_foods" ON foods FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid() AND source = 'CUSTOM');

DROP POLICY IF EXISTS "update_custom_foods" ON foods;
CREATE POLICY "update_custom_foods" ON foods FOR UPDATE
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "delete_custom_foods" ON foods;
CREATE POLICY "delete_custom_foods" ON foods FOR DELETE
  TO authenticated USING (user_id = auth.uid());

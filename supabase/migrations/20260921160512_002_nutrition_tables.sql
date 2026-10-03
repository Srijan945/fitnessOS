/*
# Create nutrition tables: foods, food entries, meals, recipes

1. New Tables
- `foods` — system food database
  - `id` (uuid, PK)
  - `name` (text, not null)
  - `brand` (text, nullable)
  - `category` (text)
  - `serving_size` (numeric, default 100)
  - `serving_unit` (text, default 'g')
  - `calories_per_serving` (numeric)
  - `protein_g`, `carbs_g`, `fat_g`, `fiber_g`, `sugar_g`, `sodium_mg` (numeric)
  - `source` (text: SYSTEM/USDA/OPEN_FOOD_FACTS)
  - `created_at`
- `user_food_overrides` — user-level corrections to food nutrition (never modifies global foods)
  - `id` (uuid, PK)
  - `user_id` (uuid, defaults to auth.uid())
  - `food_id` (uuid, references foods)
  - `calories_per_serving`, `protein_g`, `carbs_g`, `fat_g`, etc. (numeric, nullable)
  - `created_at`
- `food_entries` — logged food items with snapshotted nutrition values
  - `id` (uuid, PK)
  - `user_id` (uuid, defaults to auth.uid())
  - `food_id` (uuid, references foods, nullable — can be custom)
  - `date` (date, not null) — local date in user's timezone
  - `meal_type` (text: breakfast/lunch/dinner/snack)
  - `quantity` (numeric, not null)
  - `unit` (text: g/ml/piece/serving)
  - `food_name` (text, not null) — snapshotted name
  - `calories` (numeric, not null) — snapshotted values
  - `protein_g`, `carbs_g`, `fat_g`, `fiber_g` (numeric) — snapshotted
  - `source` (text: DATABASE/USER_OVERRIDE/CUSTOM)
  - `created_at`, `updated_at`
- `meals` — reusable meal templates
  - `id`, `user_id`, `name`, `meal_type`, `created_at`, `updated_at`
- `meal_items` — foods within a meal
  - `id`, `meal_id`, `food_id`, `quantity`, `unit`, `food_name`, `calories`, `protein_g`, `carbs_g`, `fat_g`
- `recipes` — custom recipes with auto-calculated nutrition
  - `id`, `user_id`, `name`, `servings`, `instructions`, `total_calories`, `total_protein_g`, `total_carbs_g`, `total_fat_g`, `created_at`, `updated_at`
- `recipe_items` — ingredients in a recipe
  - `id`, `recipe_id`, `food_id`, `quantity`, `unit`, `food_name`, `calories`, `protein_g`, `carbs_g`, `fat_g`
2. Security
  - foods: readable by all authenticated users (shared database)
  - user_food_overrides, food_entries, meals, meal_items, recipes, recipe_items: owner-scoped CRUD
3. Notes
  - food_entries snapshot all nutrition values at logging time for historical integrity
  - user_food_overrides never modify the global foods table
*/

-- Foods table (shared system database)
CREATE TABLE IF NOT EXISTS foods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  brand text,
  category text,
  serving_size numeric DEFAULT 100,
  serving_unit text DEFAULT 'g',
  calories_per_serving numeric NOT NULL,
  protein_g numeric DEFAULT 0,
  carbs_g numeric DEFAULT 0,
  fat_g numeric DEFAULT 0,
  fiber_g numeric DEFAULT 0,
  sugar_g numeric DEFAULT 0,
  sodium_mg numeric DEFAULT 0,
  source text DEFAULT 'SYSTEM' CHECK (source IN ('SYSTEM', 'USDA', 'OPEN_FOOD_FACTS')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE foods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_foods" ON foods;
CREATE POLICY "select_foods" ON foods FOR SELECT
  TO authenticated USING (true);

-- User food overrides
CREATE TABLE IF NOT EXISTS user_food_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  food_id uuid NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  calories_per_serving numeric,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  fiber_g numeric,
  sugar_g numeric,
  sodium_mg numeric,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, food_id)
);

ALTER TABLE user_food_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_overrides" ON user_food_overrides;
CREATE POLICY "select_own_overrides" ON user_food_overrides FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_overrides" ON user_food_overrides;
CREATE POLICY "insert_own_overrides" ON user_food_overrides FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_overrides" ON user_food_overrides;
CREATE POLICY "update_own_overrides" ON user_food_overrides FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_overrides" ON user_food_overrides;
CREATE POLICY "delete_own_overrides" ON user_food_overrides FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Food entries (logged food with snapshotted values)
CREATE TABLE IF NOT EXISTS food_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  food_id uuid REFERENCES foods(id) ON DELETE SET NULL,
  date date NOT NULL,
  meal_type text NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  quantity numeric NOT NULL CHECK (quantity > 0),
  unit text NOT NULL DEFAULT 'g',
  food_name text NOT NULL,
  calories numeric NOT NULL,
  protein_g numeric DEFAULT 0,
  carbs_g numeric DEFAULT 0,
  fat_g numeric DEFAULT 0,
  fiber_g numeric DEFAULT 0,
  source text DEFAULT 'DATABASE' CHECK (source IN ('DATABASE', 'USER_OVERRIDE', 'CUSTOM')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE food_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_food_entries" ON food_entries;
CREATE POLICY "select_own_food_entries" ON food_entries FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_food_entries" ON food_entries;
CREATE POLICY "insert_own_food_entries" ON food_entries FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_food_entries" ON food_entries;
CREATE POLICY "update_own_food_entries" ON food_entries FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_food_entries" ON food_entries;
CREATE POLICY "delete_own_food_entries" ON food_entries FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Meals (reusable)
CREATE TABLE IF NOT EXISTS meals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  meal_type text CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE meals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_meals" ON meals;
CREATE POLICY "select_own_meals" ON meals FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_meals" ON meals;
CREATE POLICY "insert_own_meals" ON meals FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_meals" ON meals;
CREATE POLICY "update_own_meals" ON meals FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_meals" ON meals;
CREATE POLICY "delete_own_meals" ON meals FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Meal items
CREATE TABLE IF NOT EXISTS meal_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id uuid NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  food_id uuid REFERENCES foods(id) ON DELETE SET NULL,
  quantity numeric NOT NULL,
  unit text NOT NULL DEFAULT 'g',
  food_name text NOT NULL,
  calories numeric NOT NULL,
  protein_g numeric DEFAULT 0,
  carbs_g numeric DEFAULT 0,
  fat_g numeric DEFAULT 0
);

ALTER TABLE meal_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_meal_items" ON meal_items;
CREATE POLICY "select_own_meal_items" ON meal_items FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM meals WHERE meals.id = meal_items.meal_id AND meals.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_meal_items" ON meal_items;
CREATE POLICY "insert_own_meal_items" ON meal_items FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM meals WHERE meals.id = meal_items.meal_id AND meals.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_meal_items" ON meal_items;
CREATE POLICY "update_own_meal_items" ON meal_items FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM meals WHERE meals.id = meal_items.meal_id AND meals.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM meals WHERE meals.id = meal_items.meal_id AND meals.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_meal_items" ON meal_items;
CREATE POLICY "delete_own_meal_items" ON meal_items FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM meals WHERE meals.id = meal_items.meal_id AND meals.user_id = auth.uid())
  );

-- Recipes
CREATE TABLE IF NOT EXISTS recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  servings int NOT NULL DEFAULT 1 CHECK (servings > 0),
  instructions text,
  total_calories numeric DEFAULT 0,
  total_protein_g numeric DEFAULT 0,
  total_carbs_g numeric DEFAULT 0,
  total_fat_g numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_recipes" ON recipes;
CREATE POLICY "select_own_recipes" ON recipes FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_recipes" ON recipes;
CREATE POLICY "insert_own_recipes" ON recipes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_recipes" ON recipes;
CREATE POLICY "update_own_recipes" ON recipes FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_recipes" ON recipes;
CREATE POLICY "delete_own_recipes" ON recipes FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Recipe items
CREATE TABLE IF NOT EXISTS recipe_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  food_id uuid REFERENCES foods(id) ON DELETE SET NULL,
  quantity numeric NOT NULL,
  unit text NOT NULL DEFAULT 'g',
  food_name text NOT NULL,
  calories numeric NOT NULL,
  protein_g numeric DEFAULT 0,
  carbs_g numeric DEFAULT 0,
  fat_g numeric DEFAULT 0
);

ALTER TABLE recipe_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_recipe_items" ON recipe_items;
CREATE POLICY "select_own_recipe_items" ON recipe_items FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM recipes WHERE recipes.id = recipe_items.recipe_id AND recipes.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_recipe_items" ON recipe_items;
CREATE POLICY "insert_own_recipe_items" ON recipe_items FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM recipes WHERE recipes.id = recipe_items.recipe_id AND recipes.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_recipe_items" ON recipe_items;
CREATE POLICY "update_own_recipe_items" ON recipe_items FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM recipes WHERE recipes.id = recipe_items.recipe_id AND recipes.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM recipes WHERE recipes.id = recipe_items.recipe_id AND recipes.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_recipe_items" ON recipe_items;
CREATE POLICY "delete_own_recipe_items" ON recipe_items FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM recipes WHERE recipes.id = recipe_items.recipe_id AND recipes.user_id = auth.uid())
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_food_entries_user_date ON food_entries(user_id, date);
CREATE INDEX IF NOT EXISTS idx_foods_name_lower ON foods (lower(name));
CREATE INDEX IF NOT EXISTS idx_user_food_overrides_user ON user_food_overrides(user_id);
CREATE INDEX IF NOT EXISTS idx_meals_user ON meals(user_id);
CREATE INDEX IF NOT EXISTS idx_recipes_user ON recipes(user_id);
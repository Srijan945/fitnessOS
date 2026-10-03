/*
# Create profiles, goals, and daily targets tables

1. New Tables
- `profiles` — user profile data (age, sex, height, weight, timezone, activity level)
  - `id` (uuid, PK, references auth.users)
  - `date_of_birth` (date)
  - `sex` (text: male/female/other)
  - `height_cm` (numeric)
  - `weight_unit` (text: kg/lb)
  - `activity_level` (text: sedentary/lightly_active/moderately_active/very_active/athlete)
  - `timezone` (text, default UTC)
  - `diet_preference` (text)
  - `meals_per_day` (int)
  - `food_preferences` (text)
  - `training_days_per_week` (int)
  - `workout_duration_minutes` (int)
  - `primary_training_type` (text)
  - `onboarding_completed` (boolean, default false)
  - `created_at`, `updated_at` (timestamps)
- `goals` — user fitness goals (fat loss, muscle gain, etc.)
  - `id` (uuid, PK)
  - `user_id` (uuid, references auth.users, defaults to auth.uid())
  - `goal_type` (text: fat_loss/muscle_gain/maintenance/recomposition/endurance/strength/custom)
  - `status` (text: active/achieved/abandoned, default active)
  - `start_date`, `target_date` (date)
  - `starting_weight_kg`, `target_weight_kg` (numeric, nullable)
  - `weekly_change_kg` (numeric, nullable)
  - `activity_target_steps` (int, nullable)
  - `created_at`, `updated_at`
- `daily_targets` — versioned daily nutrition/activity targets
  - `id` (uuid, PK)
  - `user_id` (uuid, references auth.users, defaults to auth.uid())
  - `effective_date` (date) — the date from which this target is active
  - `calorie_target` (int)
  - `protein_target_g` (numeric)
  - `carb_target_g` (numeric)
  - `fat_target_g` (numeric)
  - `source` (text: SYSTEM_CALCULATED/USER_DEFINED/AI_SUGGESTED)
  - `activity_target_steps` (int, nullable)
  - `created_at`
2. Security
  - Enable RLS on all tables
  - Owner-scoped CRUD policies on goals and daily_targets
  - Users can read/update their own profile
3. Notes
  - daily_targets uses effective_date for versioning — never overwrite historical targets
  - profiles.id references auth.users.id (1:1 relationship)
  - All user-owned tables have user_id defaulting to auth.uid()
*/

-- Profiles table (1:1 with auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  date_of_birth date,
  sex text CHECK (sex IN ('male', 'female', 'other')),
  height_cm numeric,
  weight_unit text DEFAULT 'kg' CHECK (weight_unit IN ('kg', 'lb')),
  activity_level text CHECK (activity_level IN ('sedentary', 'lightly_active', 'moderately_active', 'very_active', 'athlete')),
  timezone text DEFAULT 'UTC',
  diet_preference text,
  meals_per_day int DEFAULT 3,
  food_preferences text,
  training_days_per_week int,
  workout_duration_minutes int,
  primary_training_type text,
  onboarding_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Goals table
CREATE TABLE IF NOT EXISTS goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_type text NOT NULL CHECK (goal_type IN ('fat_loss', 'muscle_gain', 'maintenance', 'recomposition', 'endurance', 'strength', 'custom')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'achieved', 'abandoned')),
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  target_date date,
  starting_weight_kg numeric,
  target_weight_kg numeric,
  weekly_change_kg numeric,
  activity_target_steps int,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_goals" ON goals;
CREATE POLICY "select_own_goals" ON goals FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_goals" ON goals;
CREATE POLICY "insert_own_goals" ON goals FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_goals" ON goals;
CREATE POLICY "update_own_goals" ON goals FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_goals" ON goals;
CREATE POLICY "delete_own_goals" ON goals FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Daily targets table (versioned)
CREATE TABLE IF NOT EXISTS daily_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  effective_date date NOT NULL,
  calorie_target int NOT NULL,
  protein_target_g numeric NOT NULL,
  carb_target_g numeric NOT NULL,
  fat_target_g numeric NOT NULL,
  source text NOT NULL DEFAULT 'SYSTEM_CALCULATED' CHECK (source IN ('SYSTEM_CALCULATED', 'USER_DEFINED', 'AI_SUGGESTED')),
  activity_target_steps int,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE daily_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_daily_targets" ON daily_targets;
CREATE POLICY "select_own_daily_targets" ON daily_targets FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_daily_targets" ON daily_targets;
CREATE POLICY "insert_own_daily_targets" ON daily_targets FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_daily_targets" ON daily_targets;
CREATE POLICY "update_own_daily_targets" ON daily_targets FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_daily_targets" ON daily_targets;
CREATE POLICY "delete_own_daily_targets" ON daily_targets FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_targets_user_id ON daily_targets(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_targets_user_effective ON daily_targets(user_id, effective_date DESC);

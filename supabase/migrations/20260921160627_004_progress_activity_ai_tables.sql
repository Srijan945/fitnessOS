/*
# Create progress, activity, daily summaries, and AI tables

1. New Tables
- `weight_measurements` — daily weight logs
  - `id`, `user_id`, `weight_kg`, `date`, `notes`, `created_at`
- `body_measurements` — body measurement logs (waist, chest, arm, etc.)
  - `id`, `user_id`, `date`, `waist_cm`, `chest_cm`, `arm_cm`, `thigh_cm`, `hip_cm`, `neck_cm`, `body_fat_pct`, `notes`, `created_at`
- `progress_photos` — progress photo references (uses storage abstraction)
  - `id`, `user_id`, `date`, `photo_type` (front/side/back/other), `storage_path`, `notes`, `created_at`
- `activity_samples` — normalized activity data from any provider
  - `id`, `user_id`, `date`, `source` (manual/csv/apple_health/health_connect), `external_id`, `steps`, `distance_m`, `active_calories`, `resting_calories`, `exercise_minutes`, `synced_at`, `metadata` (jsonb)
- `daily_summaries` — derived/aggregated daily data
  - `id`, `user_id`, `date`, `calorie_target`, `calories_consumed`, `protein_g`, `carbs_g`, `fat_g`, `steps`, `active_calories`, `exercise_minutes`, `workout_count`, `workout_volume_kg`, `weight_kg`, `updated_at`
- `ai_conversations` — AI coach conversation sessions
  - `id`, `user_id`, `title`, `created_at`, `updated_at`
- `ai_messages` — messages within conversations
  - `id`, `conversation_id`, `user_id`, `role` (user/assistant), `content`, `tool_calls` (jsonb), `created_at`
- `ai_insights` — generated insights
  - `id`, `user_id`, `type`, `title`, `content`, `date`, `read`, `created_at`
2. Security
  - All tables: owner-scoped CRUD with auth.uid() checks
3. Notes
  - activity_samples supports deduplication via (user_id, source, external_id) unique constraint
  - daily_summaries is derived data, raw records remain source of truth
  - ai_messages stores tool_calls as jsonb for audit trail
*/

-- Weight measurements
CREATE TABLE IF NOT EXISTS weight_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  weight_kg numeric NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE weight_measurements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_weight" ON weight_measurements;
CREATE POLICY "select_own_weight" ON weight_measurements FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_weight" ON weight_measurements;
CREATE POLICY "insert_own_weight" ON weight_measurements FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_weight" ON weight_measurements;
CREATE POLICY "update_own_weight" ON weight_measurements FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_weight" ON weight_measurements;
CREATE POLICY "delete_own_weight" ON weight_measurements FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Body measurements
CREATE TABLE IF NOT EXISTS body_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  waist_cm numeric,
  chest_cm numeric,
  arm_cm numeric,
  thigh_cm numeric,
  hip_cm numeric,
  neck_cm numeric,
  body_fat_pct numeric,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE body_measurements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_measurements" ON body_measurements;
CREATE POLICY "select_own_measurements" ON body_measurements FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_measurements" ON body_measurements;
CREATE POLICY "insert_own_measurements" ON body_measurements FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_measurements" ON body_measurements;
CREATE POLICY "update_own_measurements" ON body_measurements FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_measurements" ON body_measurements;
CREATE POLICY "delete_own_measurements" ON body_measurements FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Progress photos
CREATE TABLE IF NOT EXISTS progress_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  photo_type text NOT NULL CHECK (photo_type IN ('front', 'side', 'back', 'other')),
  storage_path text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE progress_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_photos" ON progress_photos;
CREATE POLICY "select_own_photos" ON progress_photos FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_photos" ON progress_photos;
CREATE POLICY "insert_own_photos" ON progress_photos FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_photos" ON progress_photos;
CREATE POLICY "delete_own_photos" ON progress_photos FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Activity samples
CREATE TABLE IF NOT EXISTS activity_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'csv', 'apple_health', 'health_connect', 'fitbit', 'garmin')),
  external_id text,
  steps int DEFAULT 0,
  distance_m numeric DEFAULT 0,
  active_calories int DEFAULT 0,
  resting_calories int DEFAULT 0,
  exercise_minutes int DEFAULT 0,
  synced_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  UNIQUE(user_id, source, external_id)
);

ALTER TABLE activity_samples ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_activity" ON activity_samples;
CREATE POLICY "select_own_activity" ON activity_samples FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_activity" ON activity_samples;
CREATE POLICY "insert_own_activity" ON activity_samples FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_activity" ON activity_samples;
CREATE POLICY "update_own_activity" ON activity_samples FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_activity" ON activity_samples;
CREATE POLICY "delete_own_activity" ON activity_samples FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Daily summaries (derived data)
CREATE TABLE IF NOT EXISTS daily_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  calorie_target int DEFAULT 0,
  calories_consumed numeric DEFAULT 0,
  protein_g numeric DEFAULT 0,
  carbs_g numeric DEFAULT 0,
  fat_g numeric DEFAULT 0,
  steps int DEFAULT 0,
  active_calories int DEFAULT 0,
  exercise_minutes int DEFAULT 0,
  workout_count int DEFAULT 0,
  workout_volume_kg numeric DEFAULT 0,
  weight_kg numeric,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE daily_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_summaries" ON daily_summaries;
CREATE POLICY "select_own_summaries" ON daily_summaries FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_summaries" ON daily_summaries;
CREATE POLICY "insert_own_summaries" ON daily_summaries FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_summaries" ON daily_summaries;
CREATE POLICY "update_own_summaries" ON daily_summaries FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_summaries" ON daily_summaries;
CREATE POLICY "delete_own_summaries" ON daily_summaries FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- AI conversations
CREATE TABLE IF NOT EXISTS ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New Conversation',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_conversations" ON ai_conversations;
CREATE POLICY "select_own_conversations" ON ai_conversations FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_conversations" ON ai_conversations;
CREATE POLICY "insert_own_conversations" ON ai_conversations FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_conversations" ON ai_conversations;
CREATE POLICY "update_own_conversations" ON ai_conversations FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_conversations" ON ai_conversations;
CREATE POLICY "delete_own_conversations" ON ai_conversations FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- AI messages
CREATE TABLE IF NOT EXISTS ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  tool_calls jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_messages" ON ai_messages;
CREATE POLICY "select_own_messages" ON ai_messages FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_messages" ON ai_messages;
CREATE POLICY "insert_own_messages" ON ai_messages FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_messages" ON ai_messages;
CREATE POLICY "delete_own_messages" ON ai_messages FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- AI insights
CREATE TABLE IF NOT EXISTS ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_insights" ON ai_insights;
CREATE POLICY "select_own_insights" ON ai_insights FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_insights" ON ai_insights;
CREATE POLICY "insert_own_insights" ON ai_insights FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_insights" ON ai_insights;
CREATE POLICY "update_own_insights" ON ai_insights FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_insights" ON ai_insights;
CREATE POLICY "delete_own_insights" ON ai_insights FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_weight_measurements_user_date ON weight_measurements(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_body_measurements_user_date ON body_measurements(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_activity_samples_user_date ON activity_samples(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_summaries_user_date ON daily_summaries(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user ON ai_conversations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation ON ai_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_insights_user_date ON ai_insights(user_id, date DESC);
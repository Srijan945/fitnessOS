/*
# Create workout tables: exercises, templates, sessions, sets, PRs

1. New Tables
- `exercise_definitions` — system exercise catalog
  - `id` (uuid, PK)
  - `name` (text, not null)
  - `category` (text: compound/isolation/cardio/bodyweight)
  - `equipment` (text: barbell/dumbbell/machine/bodyweight/cable/kettlebell)
  - `primary_muscle` (text)
  - `secondary_muscles` (text[])
  - `instructions` (text)
  - `created_at`
- `workout_templates` — user-created workout templates
  - `id`, `user_id`, `name`, `notes`, `created_at`, `updated_at`
- `workout_template_exercises` — exercises within a template
  - `id`, `template_id`, `exercise_id`, `exercise_name`, `target_sets`, `rep_range_min`, `rep_range_max`, `rest_seconds`, `notes`, `order_index`
- `workout_sessions` — actual workout sessions
  - `id`, `user_id`, `template_id` (nullable), `name`, `status` (in_progress/completed/cancelled), `started_at`, `ended_at`, `duration_seconds`, `total_volume_kg`, `notes`
- `workout_exercises` — exercises within a session
  - `id`, `session_id`, `exercise_id`, `exercise_name`, `order_index`, `notes`
- `workout_sets` — individual sets logged during a workout
  - `id`, `workout_exercise_id`, `set_number`, `weight_kg`, `reps`, `duration_seconds`, `distance_m`, `rpe`, `rir`, `is_warmup`, `created_at`
- `personal_records` — detected PRs per exercise
  - `id`, `user_id`, `exercise_id`, `exercise_name`, `record_type` (max_weight/max_reps/max_volume/estimated_1rm), `value`, `workout_session_id`, `workout_set_id`, `date`, `created_at`
2. Security
  - exercise_definitions: readable by all authenticated users
  - All user-owned tables: owner-scoped CRUD via parent relationship
3. Notes
  - workout_sets supports weight, reps, duration, distance, RPE, RIR, warmup flag for future endurance training
  - personal_records are detected automatically by the system
*/

-- Exercise definitions (shared system catalog)
CREATE TABLE IF NOT EXISTS exercise_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text CHECK (category IN ('compound', 'isolation', 'cardio', 'bodyweight')),
  equipment text CHECK (equipment IN ('barbell', 'dumbbell', 'machine', 'bodyweight', 'cable', 'kettlebell', 'other')),
  primary_muscle text,
  secondary_muscles text[],
  instructions text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE exercise_definitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_exercises" ON exercise_definitions;
CREATE POLICY "select_exercises" ON exercise_definitions FOR SELECT
  TO authenticated USING (true);

-- Workout templates
CREATE TABLE IF NOT EXISTS workout_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE workout_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_templates" ON workout_templates;
CREATE POLICY "select_own_templates" ON workout_templates FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_templates" ON workout_templates;
CREATE POLICY "insert_own_templates" ON workout_templates FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_templates" ON workout_templates;
CREATE POLICY "update_own_templates" ON workout_templates FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_templates" ON workout_templates;
CREATE POLICY "delete_own_templates" ON workout_templates FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Workout template exercises
CREATE TABLE IF NOT EXISTS workout_template_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
  exercise_id uuid REFERENCES exercise_definitions(id) ON DELETE SET NULL,
  exercise_name text NOT NULL,
  target_sets int DEFAULT 3,
  rep_range_min int DEFAULT 8,
  rep_range_max int DEFAULT 12,
  rest_seconds int DEFAULT 90,
  notes text,
  order_index int DEFAULT 0
);

ALTER TABLE workout_template_exercises ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_template_exercises" ON workout_template_exercises;
CREATE POLICY "select_own_template_exercises" ON workout_template_exercises FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM workout_templates WHERE workout_templates.id = workout_template_exercises.template_id AND workout_templates.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_template_exercises" ON workout_template_exercises;
CREATE POLICY "insert_own_template_exercises" ON workout_template_exercises FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM workout_templates WHERE workout_templates.id = workout_template_exercises.template_id AND workout_templates.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_template_exercises" ON workout_template_exercises;
CREATE POLICY "update_own_template_exercises" ON workout_template_exercises FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM workout_templates WHERE workout_templates.id = workout_template_exercises.template_id AND workout_templates.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM workout_templates WHERE workout_templates.id = workout_template_exercises.template_id AND workout_templates.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_template_exercises" ON workout_template_exercises;
CREATE POLICY "delete_own_template_exercises" ON workout_template_exercises FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM workout_templates WHERE workout_templates.id = workout_template_exercises.template_id AND workout_templates.user_id = auth.uid())
  );

-- Workout sessions
CREATE TABLE IF NOT EXISTS workout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id uuid REFERENCES workout_templates(id) ON DELETE SET NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'cancelled')),
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  duration_seconds int,
  total_volume_kg numeric DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_sessions" ON workout_sessions;
CREATE POLICY "select_own_sessions" ON workout_sessions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_sessions" ON workout_sessions;
CREATE POLICY "insert_own_sessions" ON workout_sessions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_sessions" ON workout_sessions;
CREATE POLICY "update_own_sessions" ON workout_sessions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_sessions" ON workout_sessions;
CREATE POLICY "delete_own_sessions" ON workout_sessions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Workout exercises (exercises within a session)
CREATE TABLE IF NOT EXISTS workout_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_id uuid REFERENCES exercise_definitions(id) ON DELETE SET NULL,
  exercise_name text NOT NULL,
  order_index int DEFAULT 0,
  notes text
);

ALTER TABLE workout_exercises ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_workout_exercises" ON workout_exercises;
CREATE POLICY "select_own_workout_exercises" ON workout_exercises FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM workout_sessions WHERE workout_sessions.id = workout_exercises.session_id AND workout_sessions.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_workout_exercises" ON workout_exercises;
CREATE POLICY "insert_own_workout_exercises" ON workout_exercises FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM workout_sessions WHERE workout_sessions.id = workout_exercises.session_id AND workout_sessions.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_workout_exercises" ON workout_exercises;
CREATE POLICY "update_own_workout_exercises" ON workout_exercises FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM workout_sessions WHERE workout_sessions.id = workout_exercises.session_id AND workout_sessions.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM workout_sessions WHERE workout_sessions.id = workout_exercises.session_id AND workout_sessions.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_workout_exercises" ON workout_exercises;
CREATE POLICY "delete_own_workout_exercises" ON workout_exercises FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM workout_sessions WHERE workout_sessions.id = workout_exercises.session_id AND workout_sessions.user_id = auth.uid())
  );

-- Workout sets
CREATE TABLE IF NOT EXISTS workout_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_exercise_id uuid NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
  set_number int NOT NULL,
  weight_kg numeric,
  reps int,
  duration_seconds int,
  distance_m numeric,
  rpe numeric,
  rir int,
  is_warmup boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE workout_sets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_workout_sets" ON workout_sets;
CREATE POLICY "select_own_workout_sets" ON workout_sets FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM workout_exercises we
      JOIN workout_sessions ws ON ws.id = we.session_id
      WHERE we.id = workout_sets.workout_exercise_id AND ws.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_own_workout_sets" ON workout_sets;
CREATE POLICY "insert_own_workout_sets" ON workout_sets FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_exercises we
      JOIN workout_sessions ws ON ws.id = we.session_id
      WHERE we.id = workout_sets.workout_exercise_id AND ws.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "update_own_workout_sets" ON workout_sets;
CREATE POLICY "update_own_workout_sets" ON workout_sets FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM workout_exercises we
      JOIN workout_sessions ws ON ws.id = we.session_id
      WHERE we.id = workout_sets.workout_exercise_id AND ws.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_exercises we
      JOIN workout_sessions ws ON ws.id = we.session_id
      WHERE we.id = workout_sets.workout_exercise_id AND ws.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "delete_own_workout_sets" ON workout_sets;
CREATE POLICY "delete_own_workout_sets" ON workout_sets FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM workout_exercises we
      JOIN workout_sessions ws ON ws.id = we.session_id
      WHERE we.id = workout_sets.workout_exercise_id AND ws.user_id = auth.uid()
    )
  );

-- Personal records
CREATE TABLE IF NOT EXISTS personal_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id uuid REFERENCES exercise_definitions(id) ON DELETE SET NULL,
  exercise_name text NOT NULL,
  record_type text NOT NULL CHECK (record_type IN ('max_weight', 'max_reps', 'max_volume', 'estimated_1rm')),
  value numeric NOT NULL,
  workout_session_id uuid REFERENCES workout_sessions(id) ON DELETE SET NULL,
  workout_set_id uuid REFERENCES workout_sets(id) ON DELETE SET NULL,
  date date NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE personal_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_prs" ON personal_records;
CREATE POLICY "select_own_prs" ON personal_records FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_prs" ON personal_records;
CREATE POLICY "insert_own_prs" ON personal_records FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_prs" ON personal_records;
CREATE POLICY "update_own_prs" ON personal_records FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_prs" ON personal_records;
CREATE POLICY "delete_own_prs" ON personal_records FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workout_sessions_user ON workout_sessions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_workout_exercises_session ON workout_exercises(session_id);
CREATE INDEX IF NOT EXISTS idx_workout_sets_exercise ON workout_sets(workout_exercise_id);
CREATE INDEX IF NOT EXISTS idx_personal_records_user_exercise ON personal_records(user_id, exercise_id, record_type);
CREATE INDEX IF NOT EXISTS idx_workout_templates_user ON workout_templates(user_id);
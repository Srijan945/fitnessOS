// Database table types for FitOS

export type ActivityLevel = 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'athlete';
export type GoalType = 'fat_loss' | 'muscle_gain' | 'maintenance' | 'recomposition' | 'endurance' | 'strength' | 'custom';
export type TargetSource = 'SYSTEM_CALCULATED' | 'USER_DEFINED' | 'AI_SUGGESTED';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type FoodSource = 'DATABASE' | 'USER_OVERRIDE' | 'CUSTOM';
export type WorkoutStatus = 'in_progress' | 'completed' | 'cancelled';
export type RecordType = 'max_weight' | 'max_reps' | 'max_volume' | 'estimated_1rm';
export type PhotoType = 'front' | 'side' | 'back' | 'other';
export type ActivitySource = 'manual' | 'csv' | 'apple_health' | 'health_connect' | 'fitbit' | 'garmin';

export interface Profile {
  id: string;
  date_of_birth: string | null;
  sex: 'male' | 'female' | 'other' | null;
  height_cm: number | null;
  weight_unit: 'kg' | 'lb';
  activity_level: ActivityLevel | null;
  timezone: string;
  diet_preference: string | null;
  meals_per_day: number;
  food_preferences: string | null;
  training_days_per_week: number | null;
  workout_duration_minutes: number | null;
  primary_training_type: string | null;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface Goal {
  id: string;
  user_id: string;
  goal_type: GoalType;
  status: 'active' | 'achieved' | 'abandoned';
  start_date: string;
  target_date: string | null;
  starting_weight_kg: number | null;
  target_weight_kg: number | null;
  weekly_change_kg: number | null;
  activity_target_steps: number | null;
  created_at: string;
  updated_at: string;
}

export interface DailyTarget {
  id: string;
  user_id: string;
  effective_date: string;
  calorie_target: number;
  protein_target_g: number;
  carb_target_g: number;
  fat_target_g: number;
  source: TargetSource;
  activity_target_steps: number | null;
  created_at: string;
}

export interface Food {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  serving_size: number;
  serving_unit: string;
  calories_per_serving: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  source: string;
  created_at: string;
}

export interface UserFoodOverride {
  id: string;
  user_id: string;
  food_id: string;
  calories_per_serving: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  created_at: string;
}

export interface FoodEntry {
  id: string;
  user_id: string;
  food_id: string | null;
  date: string;
  meal_type: MealType;
  quantity: number;
  unit: string;
  food_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  source: FoodSource;
  created_at: string;
  updated_at: string;
}

export interface Meal {
  id: string;
  user_id: string;
  name: string;
  meal_type: MealType | null;
  created_at: string;
  updated_at: string;
}

export interface MealItem {
  id: string;
  meal_id: string;
  food_id: string | null;
  quantity: number;
  unit: string;
  food_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface Recipe {
  id: string;
  user_id: string;
  name: string;
  servings: number;
  instructions: string | null;
  total_calories: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  created_at: string;
  updated_at: string;
}

export interface RecipeItem {
  id: string;
  recipe_id: string;
  food_id: string | null;
  quantity: number;
  unit: string;
  food_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface ExerciseDefinition {
  id: string;
  name: string;
  category: string;
  equipment: string;
  primary_muscle: string | null;
  secondary_muscles: string[];
  instructions: string | null;
  created_at: string;
}

export interface WorkoutTemplate {
  id: string;
  user_id: string;
  name: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkoutTemplateExercise {
  id: string;
  template_id: string;
  exercise_id: string | null;
  exercise_name: string;
  target_sets: number;
  rep_range_min: number;
  rep_range_max: number;
  rest_seconds: number;
  notes: string | null;
  order_index: number;
}

export interface WorkoutSession {
  id: string;
  user_id: string;
  template_id: string | null;
  name: string;
  status: WorkoutStatus;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  total_volume_kg: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkoutExercise {
  id: string;
  session_id: string;
  exercise_id: string | null;
  exercise_name: string;
  order_index: number;
  notes: string | null;
}

export interface WorkoutSet {
  id: string;
  workout_exercise_id: string;
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
  duration_seconds: number | null;
  distance_m: number | null;
  rpe: number | null;
  rir: number | null;
  is_warmup: boolean;
  created_at: string;
}

export interface PersonalRecord {
  id: string;
  user_id: string;
  exercise_id: string | null;
  exercise_name: string;
  record_type: RecordType;
  value: number;
  workout_session_id: string | null;
  workout_set_id: string | null;
  date: string;
  created_at: string;
}

export interface WeightMeasurement {
  id: string;
  user_id: string;
  weight_kg: number;
  date: string;
  notes: string | null;
  created_at: string;
}

export interface BodyMeasurement {
  id: string;
  user_id: string;
  date: string;
  waist_cm: number | null;
  chest_cm: number | null;
  arm_cm: number | null;
  thigh_cm: number | null;
  hip_cm: number | null;
  neck_cm: number | null;
  body_fat_pct: number | null;
  notes: string | null;
  created_at: string;
}

export interface ProgressPhoto {
  id: string;
  user_id: string;
  date: string;
  photo_type: PhotoType;
  storage_path: string;
  notes: string | null;
  created_at: string;
}

export interface ActivitySample {
  id: string;
  user_id: string;
  date: string;
  source: ActivitySource;
  external_id: string | null;
  steps: number;
  distance_m: number;
  active_calories: number;
  resting_calories: number;
  exercise_minutes: number;
  synced_at: string;
  metadata: Record<string, unknown>;
}

export interface DailySummary {
  id: string;
  user_id: string;
  date: string;
  calorie_target: number;
  calories_consumed: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  steps: number;
  active_calories: number;
  exercise_minutes: number;
  workout_count: number;
  workout_volume_kg: number;
  weight_kg: number | null;
  updated_at: string;
}

export interface AIConversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface AIMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  tool_calls: unknown[];
  created_at: string;
}

export interface AIInsight {
  id: string;
  user_id: string;
  type: string;
  title: string;
  content: string;
  date: string;
  read: boolean;
  created_at: string;
}

// Loose database typing for Supabase
export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile> };
      goals: { Row: Goal; Insert: Partial<Goal>; Update: Partial<Goal> };
      daily_targets: { Row: DailyTarget; Insert: Partial<DailyTarget>; Update: Partial<DailyTarget> };
      foods: { Row: Food; Insert: Partial<Food>; Update: Partial<Food> };
      user_food_overrides: { Row: UserFoodOverride; Insert: Partial<UserFoodOverride>; Update: Partial<UserFoodOverride> };
      food_entries: { Row: FoodEntry; Insert: Partial<FoodEntry>; Update: Partial<FoodEntry> };
      meals: { Row: Meal; Insert: Partial<Meal>; Update: Partial<Meal> };
      meal_items: { Row: MealItem; Insert: Partial<MealItem>; Update: Partial<MealItem> };
      recipes: { Row: Recipe; Insert: Partial<Recipe>; Update: Partial<Recipe> };
      recipe_items: { Row: RecipeItem; Insert: Partial<RecipeItem>; Update: Partial<RecipeItem> };
      exercise_definitions: { Row: ExerciseDefinition; Insert: Partial<ExerciseDefinition>; Update: Partial<ExerciseDefinition> };
      workout_templates: { Row: WorkoutTemplate; Insert: Partial<WorkoutTemplate>; Update: Partial<WorkoutTemplate> };
      workout_template_exercises: { Row: WorkoutTemplateExercise; Insert: Partial<WorkoutTemplateExercise>; Update: Partial<WorkoutTemplateExercise> };
      workout_sessions: { Row: WorkoutSession; Insert: Partial<WorkoutSession>; Update: Partial<WorkoutSession> };
      workout_exercises: { Row: WorkoutExercise; Insert: Partial<WorkoutExercise>; Update: Partial<WorkoutExercise> };
      workout_sets: { Row: WorkoutSet; Insert: Partial<WorkoutSet>; Update: Partial<WorkoutSet> };
      personal_records: { Row: PersonalRecord; Insert: Partial<PersonalRecord>; Update: Partial<PersonalRecord> };
      weight_measurements: { Row: WeightMeasurement; Insert: Partial<WeightMeasurement>; Update: Partial<WeightMeasurement> };
      body_measurements: { Row: BodyMeasurement; Insert: Partial<BodyMeasurement>; Update: Partial<BodyMeasurement> };
      progress_photos: { Row: ProgressPhoto; Insert: Partial<ProgressPhoto>; Update: Partial<ProgressPhoto> };
      activity_samples: { Row: ActivitySample; Insert: Partial<ActivitySample>; Update: Partial<ActivitySample> };
      daily_summaries: { Row: DailySummary; Insert: Partial<DailySummary>; Update: Partial<DailySummary> };
      ai_conversations: { Row: AIConversation; Insert: Partial<AIConversation>; Update: Partial<AIConversation> };
      ai_messages: { Row: AIMessage; Insert: Partial<AIMessage>; Update: Partial<AIMessage> };
      ai_insights: { Row: AIInsight; Insert: Partial<AIInsight>; Update: Partial<AIInsight> };
    };
  };
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { calculateTargets, calculateAge } from '@/lib/domain/target-calculator';
import type { ActivityLevel, GoalType } from '@/lib/supabase/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Activity, Target, Dumbbell, Utensils, Check, Loader2, ChevronRight, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; description: string }[] = [
  { value: 'sedentary', label: 'Sedentary', description: 'Little to no exercise, desk job' },
  { value: 'lightly_active', label: 'Lightly Active', description: 'Light exercise 1-3 days/week' },
  { value: 'moderately_active', label: 'Moderately Active', description: 'Moderate exercise 3-5 days/week' },
  { value: 'very_active', label: 'Very Active', description: 'Hard exercise 6-7 days/week' },
  { value: 'athlete', label: 'Athlete', description: 'Training twice a day, physical job' },
];

const GOAL_OPTIONS: { value: GoalType; label: string; icon: string }[] = [
  { value: 'fat_loss', label: 'Fat Loss', icon: '🔥' },
  { value: 'muscle_gain', label: 'Muscle Gain', icon: '💪' },
  { value: 'maintenance', label: 'Maintenance', icon: '⚖️' },
  { value: 'recomposition', label: 'Body Recomposition', icon: '🔄' },
  { value: 'endurance', label: 'Endurance', icon: '🏃' },
  { value: 'strength', label: 'Strength', icon: '🏋️' },
  { value: 'custom', label: 'Custom', icon: '⚙️' },
];

const TOTAL_STEPS = 5;

export default function OnboardingPage() {
  const router = useRouter();
  const { user, refreshProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Step 0: Basic profile
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [sex, setSex] = useState<'male' | 'female' | 'other'>('male');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');

  // Step 1: Activity
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('moderately_active');

  // Step 2: Goal
  const [goalType, setGoalType] = useState<GoalType>('maintenance');

  // Step 3: Training & Nutrition
  const [trainingDaysPerWeek, setTrainingDaysPerWeek] = useState('4');
  const [workoutDurationMinutes, setWorkoutDurationMinutes] = useState('60');
  const [primaryTrainingType, setPrimaryTrainingType] = useState('strength');
  const [dietPreference, setDietPreference] = useState('balanced');
  const [mealsPerDay, setMealsPerDay] = useState('3');
  const [foodPreferences, setFoodPreferences] = useState('');

  // Step 4: Target review
  const [targets, setTargets] = useState<{ calorieTarget: number; proteinG: number; carbG: number; fatG: number; bmr: number; tdee: number } | null>(null);
  const [customCalorieTarget, setCustomCalorieTarget] = useState('');
  const [customProteinG, setCustomProteinG] = useState('');
  const [customCarbG, setCustomCarbG] = useState('');
  const [customFatG, setCustomFatG] = useState('');
  const [useCustom, setUseCustom] = useState(false);

  const canProceed = () => {
    switch (step) {
      case 0: return dateOfBirth && heightCm && weightKg;
      case 1: return !!activityLevel;
      case 2: return !!goalType;
      case 3: return true;
      case 4: return true;
      default: return true;
    }
  };

  const handleNext = () => {
    if (step === 3) {
      // Calculate targets
      const age = calculateAge(dateOfBirth);
      const result = calculateTargets({
        weightKg: parseFloat(weightKg),
        heightCm: parseFloat(heightCm),
        ageYears: age,
        sex,
        activityLevel,
        goalType,
      });
      setTargets(result);
      setCustomCalorieTarget(String(result.calorieTarget));
      setCustomProteinG(String(result.proteinG));
      setCustomCarbG(String(result.carbG));
      setCustomFatG(String(result.fatG));
    }
    if (step < TOTAL_STEPS - 1) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleFinish = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const finalCalorieTarget = useCustom ? parseInt(customCalorieTarget) : targets!.calorieTarget;
      const finalProteinG = useCustom ? parseFloat(customProteinG) : targets!.proteinG;
      const finalCarbG = useCustom ? parseFloat(customCarbG) : targets!.carbG;
      const finalFatG = useCustom ? parseFloat(customFatG) : targets!.fatG;

      // Upsert profile
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          date_of_birth: dateOfBirth,
          sex,
          height_cm: parseFloat(heightCm),
          weight_unit: 'kg',
          activity_level: activityLevel,
          timezone,
          diet_preference: dietPreference,
          meals_per_day: parseInt(mealsPerDay),
          food_preferences: foodPreferences || null,
          training_days_per_week: parseInt(trainingDaysPerWeek),
          workout_duration_minutes: parseInt(workoutDurationMinutes),
          primary_training_type: primaryTrainingType,
          onboarding_completed: true,
          updated_at: new Date().toISOString(),
        });
      if (profileError) throw profileError;

      // Create goal
      const { error: goalError } = await supabase.from('goals').insert({
        user_id: user.id,
        goal_type: goalType,
        status: 'active',
        start_date: new Date().toISOString().split('T')[0],
        starting_weight_kg: parseFloat(weightKg),
      });
      if (goalError) throw goalError;

      // Create daily target (versioned, effective today)
      const { error: targetError } = await supabase.from('daily_targets').insert({
        user_id: user.id,
        effective_date: new Date().toISOString().split('T')[0],
        calorie_target: finalCalorieTarget,
        protein_target_g: finalProteinG,
        carb_target_g: finalCarbG,
        fat_target_g: finalFatG,
        source: useCustom ? 'USER_DEFINED' : 'SYSTEM_CALCULATED',
      });
      if (targetError) throw targetError;

      // Log initial weight measurement
      const { error: weightError } = await supabase.from('weight_measurements').insert({
        user_id: user.id,
        weight_kg: parseFloat(weightKg),
        date: new Date().toISOString().split('T')[0],
      });
      if (weightError) throw weightError;

      await refreshProfile();
      toast.success('Profile set up! Welcome to FitOS.');
      router.push('/today');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
            <Activity className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Welcome to FitOS</h1>
            <p className="text-sm text-muted-foreground">Let&apos;s set up your fitness profile</p>
          </div>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Step {step + 1} of {TOTAL_STEPS}</span>
            <span className="text-muted-foreground">{Math.round(((step + 1) / TOTAL_STEPS) * 100)}%</span>
          </div>
          <Progress value={((step + 1) / TOTAL_STEPS) * 100} className="h-1.5" />
        </div>

        {/* Step 0: Basic Profile */}
        {step === 0 && (
          <Card className="border-border/50 animate-fade-in">
            <CardContent className="pt-6 space-y-5">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Basic Profile</h2>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="dob">Date of Birth</Label>
                  <Input id="dob" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Sex</Label>
                  <div className="flex gap-2">
                    {(['male', 'female', 'other'] as const).map((s) => (
                      <Button
                        key={s}
                        type="button"
                        variant={sex === s ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSex(s)}
                        className="flex-1 capitalize"
                      >
                        {s}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Input id="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="height">Height (cm)</Label>
                  <Input id="height" type="number" placeholder="175" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="weight">Current Weight (kg)</Label>
                  <Input id="weight" type="number" step="0.1" placeholder="75" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} required />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 1: Activity Level */}
        {step === 1 && (
          <Card className="border-border/50 animate-fade-in">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Activity Level</h2>
              </div>
              <p className="text-sm text-muted-foreground">How active are you on a typical day?</p>
              <div className="space-y-2">
                {ACTIVITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setActivityLevel(opt.value)}
                    className={`w-full text-left p-4 rounded-lg border transition-all ${
                      activityLevel === opt.value
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                        : 'border-border hover:border-primary/30 hover:bg-accent'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{opt.label}</p>
                        <p className="text-sm text-muted-foreground">{opt.description}</p>
                      </div>
                      {activityLevel === opt.value && <Check className="h-5 w-5 text-primary" />}
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Goal */}
        {step === 2 && (
          <Card className="border-border/50 animate-fade-in">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Your Primary Goal</h2>
              </div>
              <p className="text-sm text-muted-foreground">What is your main fitness objective right now?</p>
              <div className="grid grid-cols-2 gap-3">
                {GOAL_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setGoalType(opt.value)}
                    className={`p-4 rounded-lg border transition-all text-left ${
                      goalType === opt.value
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                        : 'border-border hover:border-primary/30 hover:bg-accent'
                    }`}
                  >
                    <span className="text-2xl mb-1 block">{opt.icon}</span>
                    <p className="font-medium text-sm">{opt.label}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Training & Nutrition */}
        {step === 3 && (
          <Card className="border-border/50 animate-fade-in">
            <CardContent className="pt-6 space-y-5">
              <div className="flex items-center gap-2 mb-2">
                <Dumbbell className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Training & Nutrition</h2>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="trainingDays">Training days / Week</Label>
                  <Input id="trainingDays" type="number" min="0" max="7" value={trainingDaysPerWeek} onChange={(e) => setTrainingDaysPerWeek(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="workoutDuration">Workout Duration (min)</Label>
                  <Input id="workoutDuration" type="number" min="10" max="180" value={workoutDurationMinutes} onChange={(e) => setWorkoutDurationMinutes(e.target.value)} />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="trainingType">Primary Training Type</Label>
                  <div className="flex flex-wrap gap-2">
                    {['strength', 'hypertrophy', 'powerlifting', 'crossfit', 'endurance', 'calisthenics'].map((t) => (
                      <Button
                        key={t}
                        type="button"
                        variant={primaryTrainingType === t ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setPrimaryTrainingType(t)}
                        className="capitalize"
                      >
                        {t}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mealsPerDay">Meals / Day</Label>
                  <Input id="mealsPerDay" type="number" min="1" max="8" value={mealsPerDay} onChange={(e) => setMealsPerDay(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="diet">Diet Preference</Label>
                  <select
                    id="diet"
                    value={dietPreference}
                    onChange={(e) => setDietPreference(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="balanced">Balanced</option>
                    <option value="vegetarian">Vegetarian</option>
                    <option value="vegan">Vegan</option>
                    <option value="keto">Keto</option>
                    <option value="high_protein">High Protein</option>
                    <option value="mediterranean">Mediterranean</option>
                  </select>
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="foodPrefs">Food Preferences / Restrictions (optional)</Label>
                  <Input id="foodPrefs" placeholder="e.g. no dairy, allergic to nuts" value={foodPreferences} onChange={(e) => setFoodPreferences(e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Target Review */}
        {step === 4 && targets && (
          <Card className="border-border/50 animate-fade-in">
            <CardContent className="pt-6 space-y-6">
              <div className="flex items-center gap-2 mb-2">
                <Utensils className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Your Starting Target</h2>
              </div>

              {!useCustom ? (
                <div className="text-center py-6">
                  <div className="inline-flex flex-col items-center gap-1 p-6 rounded-2xl bg-primary/5 border border-primary/20">
                    <p className="text-5xl font-bold tracking-tight">{targets.calorieTarget.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">kcal / day</p>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-6">
                    <div className="p-3 rounded-lg bg-secondary/50 text-center">
                      <p className="text-xs text-muted-foreground">Protein</p>
                      <p className="text-lg font-semibold">{targets.proteinG}g</p>
                    </div>
                    <div className="p-3 rounded-lg bg-secondary/50 text-center">
                      <p className="text-xs text-muted-foreground">Carbs</p>
                      <p className="text-lg font-semibold">{targets.carbG}g</p>
                    </div>
                    <div className="p-3 rounded-lg bg-secondary/50 text-center">
                      <p className="text-xs text-muted-foreground">Fat</p>
                      <p className="text-lg font-semibold">{targets.fatG}g</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4 text-xs text-muted-foreground justify-center">
                    <span>BMR: {targets.bmr} kcal</span>
                    <span>•</span>
                    <span>TDEE: {targets.tdee} kcal</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-4">Based on your profile, activity level, and goal.</p>
                  <div className="flex gap-2 mt-4 justify-center">
                    <Button onClick={() => setUseCustom(true)} variant="outline" size="sm">Customize</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="customCal">Calorie Target (kcal/day)</Label>
                      <Input id="customCal" type="number" value={customCalorieTarget} onChange={(e) => setCustomCalorieTarget(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customProtein">Protein (g)</Label>
                      <Input id="customProtein" type="number" value={customProteinG} onChange={(e) => setCustomProteinG(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customCarb">Carbs (g)</Label>
                      <Input id="customCarb" type="number" value={customCarbG} onChange={(e) => setCustomCarbG(e.target.value)} />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="customFat">Fat (g)</Label>
                      <Input id="customFat" type="number" value={customFatG} onChange={(e) => setCustomFatG(e.target.value)} />
                    </div>
                  </div>
                  <Button onClick={() => setUseCustom(false)} variant="ghost" size="sm">Use calculated target</Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="mt-6 flex items-center justify-between">
          <Button variant="ghost" onClick={handleBack} disabled={step === 0 || saving}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          {step < TOTAL_STEPS - 1 ? (
            <Button onClick={handleNext} disabled={!canProceed()}>
              Continue <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleFinish} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
              Start using FitOS
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

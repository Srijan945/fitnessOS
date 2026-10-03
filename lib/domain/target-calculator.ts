import type { ActivityLevel, GoalType } from '@/lib/supabase/types';

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  athlete: 1.9,
};

const GOAL_ADJUSTMENTS: Record<GoalType, { calorieAdjustment: number; proteinPerKg: number; fatPct: number }> = {
  fat_loss: { calorieAdjustment: -500, proteinPerKg: 2.2, fatPct: 0.3 },
  muscle_gain: { calorieAdjustment: 350, proteinPerKg: 2.0, fatPct: 0.25 },
  maintenance: { calorieAdjustment: 0, proteinPerKg: 1.8, fatPct: 0.3 },
  recomposition: { calorieAdjustment: -200, proteinPerKg: 2.4, fatPct: 0.3 },
  endurance: { calorieAdjustment: 200, proteinPerKg: 1.6, fatPct: 0.25 },
  strength: { calorieAdjustment: 200, proteinPerKg: 2.2, fatPct: 0.3 },
  custom: { calorieAdjustment: 0, proteinPerKg: 2.0, fatPct: 0.3 },
};

export interface TargetCalculationInput {
  weightKg: number;
  heightCm: number;
  ageYears: number;
  sex: 'male' | 'female' | 'other';
  activityLevel: ActivityLevel;
  goalType: GoalType;
}

export interface TargetCalculationResult {
  bmr: number;
  tdee: number;
  calorieTarget: number;
  proteinG: number;
  carbG: number;
  fatG: number;
}

function calculateAge(dateOfBirth: string): number {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

function calculateBMR(weightKg: number, heightCm: number, age: number, sex: string): number {
  // Mifflin-St Jeor Equation
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  if (sex === 'male') return Math.round(base + 5);
  if (sex === 'female') return Math.round(base - 161);
  return Math.round(base - 78); // average for 'other'
}

export function calculateTargets(input: TargetCalculationInput): TargetCalculationResult {
  const age = input.ageYears > 0 ? input.ageYears : 30;
  const bmr = calculateBMR(input.weightKg, input.heightCm, age, input.sex);
  const tdee = Math.round(bmr * (ACTIVITY_MULTIPLIERS[input.activityLevel] ?? 1.375));

  const goalConfig = GOAL_ADJUSTMENTS[input.goalType] ?? GOAL_ADJUSTMENTS.maintenance;
  const calorieTarget = Math.max(1200, tdee + goalConfig.calorieAdjustment);

  const proteinG = Math.round(input.weightKg * goalConfig.proteinPerKg);
  const fatG = Math.round((calorieTarget * goalConfig.fatPct) / 9);
  const proteinCalories = proteinG * 4;
  const fatCalories = fatG * 9;
  const carbG = Math.max(0, Math.round((calorieTarget - proteinCalories - fatCalories) / 4));

  return {
    bmr,
    tdee,
    calorieTarget,
    proteinG,
    carbG,
    fatG,
  };
}

export { calculateAge };

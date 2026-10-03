'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, Target, Zap, Save, Loader2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { calculateTargets, calculateAge } from '@/lib/domain/target-calculator';
import type { ActivityLevel, GoalType } from '@/lib/supabase/types';

export default function SettingsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    date_of_birth: profile?.date_of_birth ?? '',
    sex: profile?.sex ?? 'male',
    height_cm: profile?.height_cm?.toString() ?? '',
    activity_level: profile?.activity_level ?? 'moderately_active',
    timezone: profile?.timezone ?? 'UTC',
    diet_preference: profile?.diet_preference ?? 'balanced',
    meals_per_day: profile?.meals_per_day?.toString() ?? '3',
    training_days_per_week: profile?.training_days_per_week?.toString() ?? '4',
    workout_duration_minutes: profile?.workout_duration_minutes?.toString() ?? '60',
    primary_training_type: profile?.primary_training_type ?? 'strength',
  });

  // Target form state
  const [targetForm, setTargetForm] = useState({
    calorie_target: '',
    protein_target_g: '',
    carb_target_g: '',
    fat_target_g: '',
  });

  const { data: currentTarget } = useQuery({
    queryKey: ['current-target'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('daily_targets')
        .select('*')
        .lte('effective_date', today)
        .order('effective_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: goals } = useQuery({
    queryKey: ['all-goals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: latestWeight } = useQuery({
    queryKey: ['latest-weight'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weight_measurements')
        .select('*')
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Initialize target form when data loads
  useState(() => {
    if (currentTarget) {
      setTargetForm({
        calorie_target: currentTarget.calorie_target.toString(),
        protein_target_g: currentTarget.protein_target_g.toString(),
        carb_target_g: currentTarget.carb_target_g.toString(),
        fat_target_g: currentTarget.fat_target_g.toString(),
      });
    }
  });

  const saveProfileMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;
      setSaving(true);
      const { error } = await supabase.from('profiles').update({
        date_of_birth: profileForm.date_of_birth || null,
        sex: profileForm.sex,
        height_cm: parseFloat(profileForm.height_cm) || null,
        activity_level: profileForm.activity_level as ActivityLevel,
        timezone: profileForm.timezone,
        diet_preference: profileForm.diet_preference,
        meals_per_day: parseInt(profileForm.meals_per_day) || 3,
        training_days_per_week: parseInt(profileForm.training_days_per_week) || 4,
        workout_duration_minutes: parseInt(profileForm.workout_duration_minutes) || 60,
        primary_training_type: profileForm.primary_training_type,
        updated_at: new Date().toISOString(),
      }).eq('id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      refreshProfile();
      toast.success('Profile updated');
    },
    onError: (err) => toast.error(err.message),
    onSettled: () => setSaving(false),
  });

  const saveTargetMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;
      setSaving(true);
      const today = new Date().toISOString().split('T')[0];
      const { error } = await supabase.from('daily_targets').insert({
        user_id: user.id,
        effective_date: today,
        calorie_target: parseInt(targetForm.calorie_target),
        protein_target_g: parseFloat(targetForm.protein_target_g),
        carb_target_g: parseFloat(targetForm.carb_target_g),
        fat_target_g: parseFloat(targetForm.fat_target_g),
        source: 'USER_DEFINED',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-target'] });
      queryClient.invalidateQueries({ queryKey: ['current-target'] });
      toast.success('Targets updated — new target effective today');
    },
    onError: (err) => toast.error(err.message),
    onSettled: () => setSaving(false),
  });

  const recalculateTargets = () => {
    if (!profile || !latestWeight) {
      toast.error('Need profile and weight data to recalculate');
      return;
    }
    const age = calculateAge(profileForm.date_of_birth);
    const result = calculateTargets({
      weightKg: Number(latestWeight.weight_kg),
      heightCm: parseFloat(profileForm.height_cm),
      ageYears: age,
      sex: profileForm.sex as 'male' | 'female' | 'other',
      activityLevel: profileForm.activity_level as ActivityLevel,
      goalType: (goals?.find((g) => g.status === 'active')?.goal_type ?? 'maintenance') as GoalType,
    });
    setTargetForm({
      calorie_target: result.calorieTarget.toString(),
      protein_target_g: result.proteinG.toString(),
      carb_target_g: result.carbG.toString(),
      fat_target_g: result.fatG.toString(),
    });
    toast.success('Targets recalculated from your profile');
  };

  const exportData = async (format: 'csv' | 'json') => {
    if (!user) return;
    try {
      const [foodEntries, workouts, weights, measurements, goalsData] = await Promise.all([
        supabase.from('food_entries').select('*').eq('user_id', user.id).order('date', { ascending: false }),
        supabase.from('workout_sessions').select('*').eq('user_id', user.id).order('started_at', { ascending: false }),
        supabase.from('weight_measurements').select('*').eq('user_id', user.id).order('date', { ascending: false }),
        supabase.from('body_measurements').select('*').eq('user_id', user.id).order('date', { ascending: false }),
        supabase.from('goals').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      ]);

      const data = {
        exportedAt: new Date().toISOString(),
        profile: profile,
        foodEntries: foodEntries.data,
        workouts: workouts.data,
        weightMeasurements: weights.data,
        bodyMeasurements: measurements.data,
        goals: goalsData.data,
      };

      if (format === 'json') {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fitos-export-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // Simple CSV of food entries
        const headers = ['Date', 'Meal', 'Food', 'Calories', 'Protein', 'Carbs', 'Fat'];
        const rows = (foodEntries.data ?? []).map((e) =>
          [e.date, e.meal_type, e.food_name, e.calories, e.protein_g, e.carbs_g, e.fat_g].join(',')
        );
        const csv = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fitos-nutrition-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
      toast.success(`Data exported as ${format.toUpperCase()}`);
    } catch (err) {
      toast.error('Export failed');
    }
  };

  // Sync target form when currentTarget loads
  if (currentTarget && targetForm.calorie_target === '' && !saving) {
    setTargetForm({
      calorie_target: currentTarget.calorie_target.toString(),
      protein_target_g: currentTarget.protein_target_g.toString(),
      carb_target_g: currentTarget.carb_target_g.toString(),
      fat_target_g: currentTarget.fat_target_g.toString(),
    });
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your profile, goals, and integrations</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="targets">Targets</TabsTrigger>
          <TabsTrigger value="goals">Goals</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="data">Data</TabsTrigger>
        </TabsList>

        {/* Profile */}
        <TabsContent value="profile" className="space-y-4 mt-4">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4 text-primary" /> Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date of Birth</Label>
                  <Input type="date" value={profileForm.date_of_birth ?? ''} onChange={(e) => setProfileForm({ ...profileForm, date_of_birth: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Sex</Label>
                  <Select value={profileForm.sex ?? 'male'} onValueChange={(v) => setProfileForm({ ...profileForm, sex: v as 'male' | 'female' | 'other' })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Height (cm)</Label>
                  <Input type="number" value={profileForm.height_cm} onChange={(e) => setProfileForm({ ...profileForm, height_cm: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Input value={profileForm.timezone} onChange={(e) => setProfileForm({ ...profileForm, timezone: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Activity Level</Label>
                  <Select value={profileForm.activity_level ?? 'moderately_active'} onValueChange={(v) => setProfileForm({ ...profileForm, activity_level: v as ActivityLevel })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sedentary">Sedentary</SelectItem>
                      <SelectItem value="lightly_active">Lightly Active</SelectItem>
                      <SelectItem value="moderately_active">Moderately Active</SelectItem>
                      <SelectItem value="very_active">Very Active</SelectItem>
                      <SelectItem value="athlete">Athlete</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Diet Preference</Label>
                  <Select value={profileForm.diet_preference ?? 'balanced'} onValueChange={(v) => setProfileForm({ ...profileForm, diet_preference: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="balanced">Balanced</SelectItem>
                      <SelectItem value="vegetarian">Vegetarian</SelectItem>
                      <SelectItem value="vegan">Vegan</SelectItem>
                      <SelectItem value="keto">Keto</SelectItem>
                      <SelectItem value="high_protein">High Protein</SelectItem>
                      <SelectItem value="mediterranean">Mediterranean</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Training Days/Week</Label>
                  <Input type="number" min="0" max="7" value={profileForm.training_days_per_week} onChange={(e) => setProfileForm({ ...profileForm, training_days_per_week: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Workout Duration (min)</Label>
                  <Input type="number" value={profileForm.workout_duration_minutes} onChange={(e) => setProfileForm({ ...profileForm, workout_duration_minutes: e.target.value })} />
                </div>
              </div>
              <Button onClick={() => saveProfileMutation.mutate()} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Profile
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Targets */}
        <TabsContent value="targets" className="space-y-4 mt-4">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" /> Daily Targets
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Changing your target creates a new version effective today. Historical targets remain unchanged.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label>Calorie Target (kcal/day)</Label>
                  <Input type="number" value={targetForm.calorie_target} onChange={(e) => setTargetForm({ ...targetForm, calorie_target: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Protein (g)</Label>
                  <Input type="number" value={targetForm.protein_target_g} onChange={(e) => setTargetForm({ ...targetForm, protein_target_g: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Carbs (g)</Label>
                  <Input type="number" value={targetForm.carb_target_g} onChange={(e) => setTargetForm({ ...targetForm, carb_target_g: e.target.value })} />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Fat (g)</Label>
                  <Input type="number" value={targetForm.fat_target_g} onChange={(e) => setTargetForm({ ...targetForm, fat_target_g: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => saveTargetMutation.mutate()} disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save New Target
                </Button>
                <Button onClick={recalculateTargets} variant="outline" className="gap-2">
                  <Zap className="h-4 w-4" /> Recalculate
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Goals */}
        <TabsContent value="goals" className="space-y-4 mt-4">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" /> Your Goals
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {goals && goals.length > 0 ? (
                goals.map((goal) => (
                  <div key={goal.id} className="p-3 rounded-lg border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium capitalize">{goal.goal_type.replace('_', ' ')}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${goal.status === 'active' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                        {goal.status}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <p>Started: {goal.start_date}</p>
                      {goal.starting_weight_kg && <p>Starting weight: {Number(goal.starting_weight_kg).toFixed(1)} kg</p>}
                      {goal.target_weight_kg && <p>Target weight: {Number(goal.target_weight_kg).toFixed(1)} kg</p>}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No goals set yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrations */}
        <TabsContent value="integrations" className="space-y-4 mt-4">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" /> Activity Integrations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { name: 'Apple Health', status: 'Available', desc: 'Sync steps, calories, and workouts from iPhone' },
                { name: 'Health Connect', status: 'Available', desc: 'Sync activity from Android devices' },
                { name: 'Fitbit', status: 'Coming Soon', desc: 'Sync steps, heart rate, and sleep' },
                { name: 'Garmin', status: 'Coming Soon', desc: 'Sync workouts and activity data' },
                { name: 'CSV Import', status: 'Available', desc: 'Import activity data from a CSV file' },
              ].map((integration) => (
                <div key={integration.name} className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div>
                    <p className="font-medium text-sm">{integration.name}</p>
                    <p className="text-xs text-muted-foreground">{integration.desc}</p>
                  </div>
                  <Button size="sm" variant={integration.status === 'Coming Soon' ? 'outline' : 'default'} disabled={integration.status === 'Coming Soon'}>
                    {integration.status === 'Coming Soon' ? 'Soon' : 'Connect'}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Data Export */}
        <TabsContent value="data" className="space-y-4 mt-4">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Download className="h-4 w-4 text-primary" /> Export Your Data
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Download all your FitOS data — nutrition entries, workouts, weight history, measurements, and goals.
              </p>
              <div className="flex gap-2">
                <Button onClick={() => exportData('json')} variant="outline" className="gap-2">
                  <Download className="h-4 w-4" /> Export as JSON
                </Button>
                <Button onClick={() => exportData('csv')} variant="outline" className="gap-2">
                  <Download className="h-4 w-4" /> Export Nutrition CSV
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

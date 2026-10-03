'use client';

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Flame, Footprints, Dumbbell, Scale, TrendingUp, Plus, Sparkles, Clock, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

export default function TodayPage() {
  const { user } = useAuth();
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: target } = useQuery({
    queryKey: ['daily-target', today],
    queryFn: async () => {
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

  const { data: foodEntries } = useQuery({
    queryKey: ['food-entries', today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('food_entries')
        .select('*')
        .eq('date', today)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: todayWorkouts } = useQuery({
    queryKey: ['today-workouts'],
    queryFn: async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from('workout_sessions')
        .select('*')
        .gte('started_at', todayStart.toISOString())
        .order('started_at', { ascending: false });
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

  const { data: activityToday } = useQuery({
    queryKey: ['activity-today', today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_samples')
        .select('*')
        .eq('date', today)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const consumed = foodEntries?.reduce((sum, e) => sum + Number(e.calories), 0) ?? 0;
  const consumedProtein = foodEntries?.reduce((sum, e) => sum + Number(e.protein_g), 0) ?? 0;
  const consumedCarbs = foodEntries?.reduce((sum, e) => sum + Number(e.carbs_g), 0) ?? 0;
  const consumedFat = foodEntries?.reduce((sum, e) => sum + Number(e.fat_g), 0) ?? 0;

  const calorieTarget = target?.calorie_target ?? 0;
  const remaining = Math.max(0, calorieTarget - consumed);
  const progressPct = calorieTarget > 0 ? Math.min(100, (consumed / calorieTarget) * 100) : 0;

  const workoutCompleted = todayWorkouts?.some((w) => w.status === 'completed');
  const workoutInProgress = todayWorkouts?.some((w) => w.status === 'in_progress');

  const timeline: { time: string; title: string; subtitle: string; icon: 'food' | 'workout' | 'activity' }[] = [];

  // Add food entries to timeline
  foodEntries?.forEach((entry) => {
    const time = format(new Date(entry.created_at), 'HH:mm');
    timeline.push({
      time,
      title: entry.food_name,
      subtitle: `${Math.round(Number(entry.calories))} kcal · ${entry.meal_type}`,
      icon: 'food',
    });
  });

  // Add workouts to timeline
  todayWorkouts?.forEach((workout) => {
    const time = format(new Date(workout.started_at), 'HH:mm');
    const duration = workout.duration_seconds
      ? Math.round(workout.duration_seconds / 60)
      : null;
    timeline.push({
      time,
      title: workout.name,
      subtitle: duration ? `${duration} min` : 'In progress',
      icon: 'workout',
    });
  });

  timeline.sort((a, b) => a.time.localeCompare(b.time));

  const steps = activityToday?.steps ?? 0;
  const activeCalories = activityToday?.active_calories ?? 0;
  const exerciseMinutes = activityToday?.exercise_minutes ?? 0;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Today</h1>
          <p className="text-sm text-muted-foreground">{format(new Date(), 'EEEE, MMMM d')}</p>
        </div>
        <Link href="/nutrition">
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" /> Log Food
          </Button>
        </Link>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Calorie Ring */}
        <Card className="lg:col-span-1 border-border/50">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center">
              <div className="relative w-48 h-48">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
                  <circle
                    cx="100" cy="100" r="85"
                    fill="none"
                    stroke="hsl(var(--muted))"
                    strokeWidth="12"
                  />
                  <circle
                    cx="100" cy="100" r="85"
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 85}`}
                    strokeDashoffset={`${2 * Math.PI * 85 * (1 - progressPct / 100)}`}
                    className="transition-all duration-700 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold">{Math.round(consumed).toLocaleString()}</span>
                  <span className="text-sm text-muted-foreground">/ {calorieTarget.toLocaleString()} kcal</span>
                  <span className="text-xs text-primary font-medium mt-1">{remaining > 0 ? `${Math.round(remaining)} remaining` : 'Target met'}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
                <Flame className="h-4 w-4 text-primary" />
                <span>Calories consumed</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Macros */}
        <Card className="lg:col-span-2 border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Macros</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <MacroBar
              label="Protein"
              consumed={consumedProtein}
              target={target?.protein_target_g ?? 0}
              unit="g"
              color="hsl(var(--chart-1))"
            />
            <MacroBar
              label="Carbs"
              consumed={consumedCarbs}
              target={target?.carb_target_g ?? 0}
              unit="g"
              color="hsl(var(--chart-2))"
            />
            <MacroBar
              label="Fat"
              consumed={consumedFat}
              target={target?.fat_target_g ?? 0}
              unit="g"
              color="hsl(var(--chart-5))"
            />
          </CardContent>
        </Card>
      </div>

      {/* Activity + Workout + Weight row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Activity */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Footprints className="h-4 w-4 text-primary" /> Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Steps</span>
              <span className="font-semibold">{steps.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Active calories</span>
              <span className="font-semibold">{activeCalories} kcal</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Exercise minutes</span>
              <span className="font-semibold">{exerciseMinutes} min</span>
            </div>
            {steps === 0 && (
              <p className="text-xs text-muted-foreground pt-1">No activity logged yet.</p>
            )}
          </CardContent>
        </Card>

        {/* Workout Status */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Dumbbell className="h-4 w-4 text-primary" /> Workout
            </CardTitle>
          </CardHeader>
          <CardContent>
            {workoutCompleted ? (
              <div className="flex flex-col items-center gap-2 py-2">
                <CheckCircle2 className="h-8 w-8 text-success" />
                <p className="font-medium">Workout completed</p>
                <p className="text-xs text-muted-foreground">Great work today!</p>
              </div>
            ) : workoutInProgress ? (
              <div className="flex flex-col items-center gap-2 py-2">
                <Clock className="h-8 w-8 text-warning animate-pulse" />
                <p className="font-medium">Workout in progress</p>
                <Link href="/workouts">
                  <Button size="sm" variant="outline" className="mt-1">Resume</Button>
                </Link>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-2">
                <Dumbbell className="h-8 w-8 text-muted-foreground" />
                <p className="font-medium">No workout today</p>
                <Link href="/workouts">
                  <Button size="sm" className="mt-1 gap-2">
                    <Plus className="h-4 w-4" /> Start Workout
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Weight */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Scale className="h-4 w-4 text-primary" /> Weight
            </CardTitle>
          </CardHeader>
          <CardContent>
            {latestWeight ? (
              <div className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold">{Number(latestWeight.weight_kg).toFixed(1)}</span>
                  <span className="text-sm text-muted-foreground">kg</span>
                </div>
                <p className="text-xs text-muted-foreground">Logged {format(new Date(latestWeight.date), 'MMM d')}</p>
                <Link href="/progress">
                  <Button size="sm" variant="ghost" className="mt-1 gap-2 text-xs">
                    <TrendingUp className="h-3 w-3" /> View trend
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-2">
                <Scale className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No weight logged</p>
                <Link href="/progress">
                  <Button size="sm" variant="outline" className="mt-1 gap-2">
                    <Plus className="h-3 w-3" /> Log Weight
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI Insight + Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* AI Insight */}
        <Card className="border-border/50 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Today&apos;s Insight
            </CardTitle>
          </CardHeader>
          <CardContent>
            {consumed > 0 && target ? (
              <p className="text-sm leading-relaxed">
                {remaining > 0 ? (
                  <>
                    You&apos;ve consumed <strong>{Math.round(consumed)} kcal</strong> out of your{' '}
                    <strong>{calorieTarget} kcal</strong> target, with{' '}
                    <strong>{Math.round(remaining)} kcal</strong> remaining.
                    {consumedProtein < Number(target.protein_target_g) && (
                      <>
                        {' '}You&apos;re <strong>{Math.round(Number(target.protein_target_g) - consumedProtein)}g</strong> short of your protein target.
                      </>
                    )}
                  </>
                ) : (
                  <>You&apos;ve met your calorie target for today. Focus on hitting your protein goal and staying active.</>
                )}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Start logging food to get personalized insights about your nutrition and progress.
              </p>
            )}
            <Link href="/ai-coach">
              <Button variant="ghost" size="sm" className="mt-3 gap-2 text-primary">
                Ask AI Coach <Sparkles className="h-3 w-3" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Today&apos;s Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            {timeline.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">Nothing logged yet today.</p>
                <p className="text-xs text-muted-foreground mt-1">Your food, workouts, and activity will appear here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {timeline.map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
                        item.icon === 'food' ? 'bg-chart-2/10 text-chart-2' :
                        item.icon === 'workout' ? 'bg-chart-1/10 text-chart-1' :
                        'bg-chart-4/10 text-chart-4'
                      }`}>
                        {item.icon === 'food' ? <Flame className="h-3.5 w-3.5" /> :
                         item.icon === 'workout' ? <Dumbbell className="h-3.5 w-3.5" /> :
                         <Footprints className="h-3.5 w-3.5" />}
                      </div>
                      {i < timeline.length - 1 && <div className="w-px h-6 bg-border mt-1" />}
                    </div>
                    <div className="flex-1 pb-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{item.title}</p>
                        <span className="text-xs text-muted-foreground">{item.time}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MacroBar({ label, consumed, target, unit, color }: { label: string; consumed: number; target: number; unit: string; color: string }) {
  const pct = target > 0 ? Math.min(100, (consumed / target) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          <span className="font-semibold text-foreground">{Math.round(consumed)}</span> / {Math.round(target)} {unit}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

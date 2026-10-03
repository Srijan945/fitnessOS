'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Flame, Dumbbell, Footprints, Scale, TrendingUp, Activity } from 'lucide-react';
import { format, subDays } from 'date-fns';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Area, AreaChart,
} from 'recharts';

type RangeKey = '7D' | '30D' | '90D' | '1Y' | 'ALL';

const RANGE_DAYS: Record<RangeKey, number> = {
  '7D': 7,
  '30D': 30,
  '90D': 90,
  '1Y': 365,
  'ALL': 9999,
};

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [range, setRange] = useState<RangeKey>('30D');
  const days = RANGE_DAYS[range];
  const startDate = format(subDays(new Date(), days), 'yyyy-MM-dd');

  const { data: foodEntries } = useQuery({
    queryKey: ['analytics-food', startDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('food_entries')
        .select('date, calories, protein_g, carbs_g, fat_g')
        .gte('date', startDate)
        .order('date', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: workouts } = useQuery({
    queryKey: ['analytics-workouts', startDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workout_sessions')
        .select('id, name, started_at, duration_seconds, total_volume_kg, status')
        .eq('status', 'completed')
        .gte('started_at', startDate)
        .order('started_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: weightData } = useQuery({
    queryKey: ['analytics-weight', startDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weight_measurements')
        .select('date, weight_kg')
        .gte('date', startDate)
        .order('date', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: activityData } = useQuery({
    queryKey: ['analytics-activity', startDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_samples')
        .select('date, steps, active_calories, exercise_minutes')
        .gte('date', startDate)
        .order('date', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  // Aggregate nutrition by date
  const nutritionByDate = (foodEntries ?? []).reduce((acc, entry) => {
    const date = entry.date;
    if (!acc[date]) acc[date] = { date, calories: 0, protein: 0, carbs: 0, fat: 0 };
    acc[date].calories += Number(entry.calories);
    acc[date].protein += Number(entry.protein_g);
    acc[date].carbs += Number(entry.carbs_g);
    acc[date].fat += Number(entry.fat_g);
    return acc;
  }, {} as Record<string, { date: string; calories: number; protein: number; carbs: number; fat: number }>);

  const nutritionChartData = Object.values(nutritionByDate).map((d) => ({
    date: format(new Date(d.date), 'MMM d'),
    calories: Math.round(d.calories),
    protein: Math.round(d.protein),
    carbs: Math.round(d.carbs),
    fat: Math.round(d.fat),
  }));

  const avgCalories = nutritionChartData.length > 0
    ? Math.round(nutritionChartData.reduce((s, d) => s + d.calories, 0) / nutritionChartData.length)
    : 0;
  const avgProtein = nutritionChartData.length > 0
    ? Math.round(nutritionChartData.reduce((s, d) => s + d.protein, 0) / nutritionChartData.length)
    : 0;

  // Workout stats
  const workoutCount = workouts?.length ?? 0;
  const totalVolume = workouts?.reduce((s, w) => s + Number(w.total_volume_kg), 0) ?? 0;
  const totalDuration = workouts?.reduce((s, w) => s + (w.duration_seconds ?? 0), 0) ?? 0;
  const avgDuration = workoutCount > 0 ? Math.round(totalDuration / workoutCount / 60) : 0;

  // Weight chart
  const weightChartData = (weightData ?? []).map((w) => ({
    date: format(new Date(w.date), 'MMM d'),
    weight: Math.round(Number(w.weight_kg) * 10) / 10,
  }));

  // Activity chart
  const activityChartData = (activityData ?? []).map((a) => ({
    date: format(new Date(a.date), 'MMM d'),
    steps: a.steps ?? 0,
    activeCalories: a.active_calories ?? 0,
  }));

  // Consistency: days with food logged / total days
  const loggedDays = nutritionChartData.length;
  const consistencyPct = days > 0 ? Math.round((loggedDays / Math.min(days, 365)) * 100) : 0;

  // Workout frequency by day of week
  const workoutByDay = [0, 0, 0, 0, 0, 0, 0];
  workouts?.forEach((w) => {
    const day = new Date(w.started_at).getDay();
    workoutByDay[day]++;
  });
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const workoutFreqData = dayNames.map((name, i) => ({ day: name, sessions: workoutByDay[i] }));

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground">Insights from your fitness data</p>
        </div>
        <Tabs value={range} onValueChange={(v) => setRange(v as RangeKey)}>
          <TabsList>
            <TabsTrigger value="7D">7D</TabsTrigger>
            <TabsTrigger value="30D">30D</TabsTrigger>
            <TabsTrigger value="90D">90D</TabsTrigger>
            <TabsTrigger value="1Y">1Y</TabsTrigger>
            <TabsTrigger value="ALL">ALL</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border/50">
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-2">
              <Flame className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Avg Calories</span>
            </div>
            <p className="text-2xl font-bold">{avgCalories.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">kcal/day</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-2">
              <Dumbbell className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Workouts</span>
            </div>
            <p className="text-2xl font-bold">{workoutCount}</p>
            <p className="text-xs text-muted-foreground">{avgDuration} min avg</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Total Volume</span>
            </div>
            <p className="text-2xl font-bold">{Math.round(totalVolume).toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">kg lifted</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Consistency</span>
            </div>
            <p className="text-2xl font-bold">{consistencyPct}%</p>
            <p className="text-xs text-muted-foreground">{loggedDays} days logged</p>
          </CardContent>
        </Card>
      </div>

      {/* Nutrition chart */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Flame className="h-4 w-4 text-primary" /> Nutrition
          </CardTitle>
        </CardHeader>
        <CardContent>
          {nutritionChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={nutritionChartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <defs>
                  <linearGradient id="calGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                <Area type="monotone" dataKey="calories" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#calGrad)" name="Calories" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="py-12 text-center">
              <Flame className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No nutrition data for this period</p>
            </div>
          )}
          {avgProtein > 0 && (
            <p className="text-xs text-muted-foreground text-center mt-2">Average protein: {avgProtein}g/day</p>
          )}
        </CardContent>
      </Card>

      {/* Workout frequency */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Dumbbell className="h-4 w-4 text-primary" /> Workout Frequency
          </CardTitle>
        </CardHeader>
        <CardContent>
          {workoutCount > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={workoutFreqData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                <Bar dataKey="sessions" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="py-12 text-center">
              <Dumbbell className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No workouts in this period</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Weight trend */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Scale className="h-4 w-4 text-primary" /> Weight Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          {weightChartData.length > 1 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={weightChartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} domain={['dataMin - 1', 'dataMax + 1']} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                <Line type="monotone" dataKey="weight" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="py-12 text-center">
              <Scale className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Not enough weight data for this period</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Footprints className="h-4 w-4 text-primary" /> Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activityChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={activityChartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                <Bar dataKey="steps" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="py-12 text-center">
              <Footprints className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No activity data for this period</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

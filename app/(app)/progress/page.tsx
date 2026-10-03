'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Scale, Ruler, Trophy, TrendingUp, TrendingDown, Minus, Target, Loader2 } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { toast } from 'sonner';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import type { WeightMeasurement, BodyMeasurement, PersonalRecord } from '@/lib/supabase/types';

export default function ProgressPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [weightDialogOpen, setWeightDialogOpen] = useState(false);
  const [measurementDialogOpen, setMeasurementDialogOpen] = useState(false);
  const [newWeight, setNewWeight] = useState('');
  const [newMeasurements, setNewMeasurements] = useState({ waist: '', chest: '', arm: '', thigh: '', hip: '', neck: '', bodyFat: '' });

  const { data: weightHistory } = useQuery({
    queryKey: ['weight-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weight_measurements')
        .select('*')
        .order('date', { ascending: true })
        .limit(90);
      if (error) throw error;
      return (data ?? []) as WeightMeasurement[];
    },
    enabled: !!user,
  });

  const { data: measurements } = useQuery({
    queryKey: ['body-measurements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('body_measurements')
        .select('*')
        .order('date', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as BodyMeasurement[];
    },
    enabled: !!user,
  });

  const { data: personalRecords } = useQuery({
    queryKey: ['personal-records'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('personal_records')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as PersonalRecord[];
    },
    enabled: !!user,
  });

  const { data: activeGoal } = useQuery({
    queryKey: ['active-goal'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('status', 'active')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const addWeightMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase.from('weight_measurements').insert({
        user_id: user.id,
        weight_kg: parseFloat(newWeight),
        date: format(new Date(), 'yyyy-MM-dd'),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weight-history'] });
      queryClient.invalidateQueries({ queryKey: ['latest-weight'] });
      toast.success('Weight logged');
      setWeightDialogOpen(false);
      setNewWeight('');
    },
    onError: (err) => toast.error(err.message),
  });

  const addMeasurementMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase.from('body_measurements').insert({
        user_id: user.id,
        date: format(new Date(), 'yyyy-MM-dd'),
        waist_cm: newMeasurements.waist ? parseFloat(newMeasurements.waist) : null,
        chest_cm: newMeasurements.chest ? parseFloat(newMeasurements.chest) : null,
        arm_cm: newMeasurements.arm ? parseFloat(newMeasurements.arm) : null,
        thigh_cm: newMeasurements.thigh ? parseFloat(newMeasurements.thigh) : null,
        hip_cm: newMeasurements.hip ? parseFloat(newMeasurements.hip) : null,
        neck_cm: newMeasurements.neck ? parseFloat(newMeasurements.neck) : null,
        body_fat_pct: newMeasurements.bodyFat ? parseFloat(newMeasurements.bodyFat) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['body-measurements'] });
      toast.success('Measurements logged');
      setMeasurementDialogOpen(false);
      setNewMeasurements({ waist: '', chest: '', arm: '', thigh: '', hip: '', neck: '', bodyFat: '' });
    },
    onError: (err) => toast.error(err.message),
  });

  // Calculate 7-day moving average
  const weightChartData = (weightHistory ?? []).map((w, i, arr) => {
    const start = Math.max(0, i - 6);
    const window = arr.slice(start, i + 1);
    const avg = window.reduce((s, x) => s + Number(x.weight_kg), 0) / window.length;
    return {
      date: format(new Date(w.date), 'MMM d'),
      weight: Math.round(Number(w.weight_kg) * 10) / 10,
      avg: Math.round(avg * 10) / 10,
    };
  });

  const latestWeight = weightHistory?.[weightHistory.length - 1];
  const previousWeight = weightHistory?.[weightHistory.length - 8];
  const weightTrend = latestWeight && previousWeight
    ? Number(latestWeight.weight_kg) - Number(previousWeight.weight_kg)
    : 0;
  const trendIcon = weightTrend < -0.1 ? <TrendingDown className="h-4 w-4 text-success" /> :
                    weightTrend > 0.1 ? <TrendingUp className="h-4 w-4 text-destructive" /> :
                    <Minus className="h-4 w-4 text-muted-foreground" />;

  // Group PRs by exercise
  const prsByExercise = (personalRecords ?? []).reduce((acc, pr) => {
    const key = pr.exercise_name;
    if (!acc[key]) acc[key] = [];
    acc[key].push(pr);
    return acc;
  }, {} as Record<string, PersonalRecord[]>);

  // Goal progress
  const goalProgress = activeGoal && activeGoal.starting_weight_kg && activeGoal.target_weight_kg && latestWeight
    ? {
        start: Number(activeGoal.starting_weight_kg),
        current: Number(latestWeight.weight_kg),
        target: Number(activeGoal.target_weight_kg),
        pct: Math.min(100, Math.abs(Number(latestWeight.weight_kg) - Number(activeGoal.starting_weight_kg)) /
              Math.abs(Number(activeGoal.target_weight_kg) - Number(activeGoal.starting_weight_kg)) * 100),
      }
    : null;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Progress</h1>
        <p className="text-sm text-muted-foreground">Track your body and strength improvements</p>
      </div>

      <Tabs defaultValue="weight">
        <TabsList>
          <TabsTrigger value="weight">Weight</TabsTrigger>
          <TabsTrigger value="measurements">Measurements</TabsTrigger>
          <TabsTrigger value="strength">Strength</TabsTrigger>
          <TabsTrigger value="goal">Goal</TabsTrigger>
        </TabsList>

        {/* Weight Tab */}
        <TabsContent value="weight" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <Scale className="h-6 w-6 text-primary" />
              </div>
              <div>
                {latestWeight ? (
                  <>
                    <p className="text-2xl font-bold">{Number(latestWeight.weight_kg).toFixed(1)} kg</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      {trendIcon}
                      {weightTrend === 0 ? 'Stable' : `${weightTrend > 0 ? '+' : ''}${weightTrend.toFixed(1)} kg vs last week`}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No weight logged yet</p>
                )}
              </div>
            </div>
            <Dialog open={weightDialogOpen} onOpenChange={setWeightDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" /> Log Weight
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Log Weight</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Weight (kg)</Label>
                    <Input type="number" step="0.1" placeholder="75.5" value={newWeight} onChange={(e) => setNewWeight(e.target.value)} />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={() => addWeightMutation.mutate()} disabled={!newWeight || addWeightMutation.isPending}>
                    {addWeightMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {weightChartData.length > 0 ? (
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-base">Weight Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={weightChartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} domain={['dataMin - 1', 'dataMax + 1']} />
                    <Tooltip
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Line type="monotone" dataKey="weight" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} dot={{ r: 2 }} name="Daily" />
                    <Line type="monotone" dataKey="avg" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} name="7-day avg" />
                  </LineChart>
                </ResponsiveContainer>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Daily weight with 7-day moving average. Don&apos;t overinterpret individual weigh-ins.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/50 border-dashed">
              <CardContent className="py-12 text-center">
                <Scale className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium">Start logging weight to see your trend</p>
                <p className="text-xs text-muted-foreground mt-1">Daily weight + 7-day moving average</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Measurements Tab */}
        <TabsContent value="measurements" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <Ruler className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-lg font-semibold">Body Measurements</p>
                <p className="text-xs text-muted-foreground">{measurements?.length ?? 0} entries logged</p>
              </div>
            </div>
            <Dialog open={measurementDialogOpen} onOpenChange={setMeasurementDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" /> Log Measurements
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Log Body Measurements</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'waist', label: 'Waist (cm)' },
                    { key: 'chest', label: 'Chest (cm)' },
                    { key: 'arm', label: 'Arm (cm)' },
                    { key: 'thigh', label: 'Thigh (cm)' },
                    { key: 'hip', label: 'Hip (cm)' },
                    { key: 'neck', label: 'Neck (cm)' },
                    { key: 'bodyFat', label: 'Body Fat (%)' },
                  ].map((field) => (
                    <div key={field.key} className="space-y-1">
                      <Label className="text-xs">{field.label}</Label>
                      <Input
                        type="number"
                        step="0.1"
                        placeholder="—"
                        value={newMeasurements[field.key as keyof typeof newMeasurements]}
                        onChange={(e) => setNewMeasurements({ ...newMeasurements, [field.key]: e.target.value })}
                      />
                    </div>
                  ))}
                </div>
                <DialogFooter>
                  <Button onClick={() => addMeasurementMutation.mutate()} disabled={addMeasurementMutation.isPending}>
                    {addMeasurementMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {measurements && measurements.length > 0 ? (
            <Card className="border-border/50">
              <CardContent className="pt-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-2 font-medium text-muted-foreground">Date</th>
                        <th className="text-right p-2 font-medium text-muted-foreground">Waist</th>
                        <th className="text-right p-2 font-medium text-muted-foreground">Chest</th>
                        <th className="text-right p-2 font-medium text-muted-foreground">Arm</th>
                        <th className="text-right p-2 font-medium text-muted-foreground">Thigh</th>
                        <th className="text-right p-2 font-medium text-muted-foreground">Hip</th>
                        <th className="text-right p-2 font-medium text-muted-foreground">BF%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {measurements.map((m) => (
                        <tr key={m.id} className="border-b border-border/50">
                          <td className="p-2">{format(new Date(m.date), 'MMM d')}</td>
                          <td className="text-right p-2">{m.waist_cm ? Number(m.waist_cm).toFixed(1) : '—'}</td>
                          <td className="text-right p-2">{m.chest_cm ? Number(m.chest_cm).toFixed(1) : '—'}</td>
                          <td className="text-right p-2">{m.arm_cm ? Number(m.arm_cm).toFixed(1) : '—'}</td>
                          <td className="text-right p-2">{m.thigh_cm ? Number(m.thigh_cm).toFixed(1) : '—'}</td>
                          <td className="text-right p-2">{m.hip_cm ? Number(m.hip_cm).toFixed(1) : '—'}</td>
                          <td className="text-right p-2">{m.body_fat_pct ? Number(m.body_fat_pct).toFixed(1) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/50 border-dashed">
              <CardContent className="py-12 text-center">
                <Ruler className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium">No measurements logged yet</p>
                <p className="text-xs text-muted-foreground mt-1">Track waist, chest, arms, and more over time</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Strength Tab */}
        <TabsContent value="strength" className="space-y-4 mt-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning/10">
              <Trophy className="h-6 w-6 text-warning" />
            </div>
            <div>
              <p className="text-lg font-semibold">Personal Records</p>
              <p className="text-xs text-muted-foreground">{Object.keys(prsByExercise).length} exercises with PRs</p>
            </div>
          </div>

          {Object.keys(prsByExercise).length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(prsByExercise).map(([exercise, prs]) => {
                const maxWeightPR = prs.find((p) => p.record_type === 'max_weight');
                return (
                  <Card key={exercise} className="border-border/50">
                    <CardContent className="pt-5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
                          <Trophy className="h-5 w-5 text-warning" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{exercise}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(prs[0].date), 'MMM d, yyyy')}</p>
                        </div>
                      </div>
                      {maxWeightPR && (
                        <div className="text-right">
                          <p className="text-xl font-bold">{Number(maxWeightPR.value).toFixed(1)}<span className="text-sm font-normal text-muted-foreground ml-1">kg</span></p>
                          <p className="text-xs text-muted-foreground">Max Weight</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="border-border/50 border-dashed">
              <CardContent className="py-12 text-center">
                <Trophy className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium">No personal records yet</p>
                <p className="text-xs text-muted-foreground mt-1">Complete workouts to automatically detect PRs</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Goal Tab */}
        <TabsContent value="goal" className="space-y-4 mt-4">
          {activeGoal && goalProgress ? (
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-base capitalize flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  {activeGoal.goal_type.replace('_', ' ')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Starting</p>
                    <p className="font-semibold">{goalProgress.start.toFixed(1)} kg</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Current</p>
                    <p className="font-semibold text-primary">{goalProgress.current.toFixed(1)} kg</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Target</p>
                    <p className="font-semibold">{goalProgress.target.toFixed(1)} kg</p>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">{Math.round(goalProgress.pct)}%</span>
                  </div>
                  <div className="h-3 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${goalProgress.pct}%` }}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Started {format(new Date(activeGoal.start_date), 'MMM d, yyyy')}
                  {activeGoal.target_date && ` · Target by ${format(new Date(activeGoal.target_date), 'MMM d, yyyy')}`}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/50 border-dashed">
              <CardContent className="py-12 text-center">
                <Target className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium">No active goal</p>
                <p className="text-xs text-muted-foreground mt-1">Set a goal in Settings to track your progress</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

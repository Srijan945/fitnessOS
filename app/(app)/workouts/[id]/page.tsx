'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, Check, Loader2, ChevronLeft, Trophy, TrendingUp, Save } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useRouter, useParams } from 'next/navigation';
import type { ExerciseDefinition, WorkoutSession, WorkoutExercise, WorkoutSet } from '@/lib/supabase/types';

export default function WorkoutSessionPage() {
  const params = useParams();
  const sessionId = params.id as string;
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [elapsed, setElapsed] = useState(0);
  const [addExerciseOpen, setAddExerciseOpen] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [prevPerformance, setPrevPerformance] = useState<Record<string, { weight: number; reps: number } | null>>({});

  // Fetch session
  const { data: session } = useQuery({
    queryKey: ['workout-session', sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('id', sessionId)
        .maybeSingle();
      if (error) throw error;
      return data as WorkoutSession | null;
    },
    enabled: !!sessionId,
  });

  // Fetch exercises in session
  const { data: workoutExercises, refetch: refetchExercises } = useQuery({
    queryKey: ['workout-exercises', sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workout_exercises')
        .select('*')
        .eq('session_id', sessionId)
        .order('order_index', { ascending: true });
      if (error) throw error;
      return (data ?? []) as WorkoutExercise[];
    },
    enabled: !!sessionId,
  });

  // Fetch all exercises catalog
  const { data: exercises } = useQuery({
    queryKey: ['exercises'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exercise_definitions')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ExerciseDefinition[];
    },
  });

  // Fetch sets for all exercises in this session
  const { data: sets, refetch: refetchSets } = useQuery({
    queryKey: ['workout-sets-all', sessionId],
    queryFn: async () => {
      if (!workoutExercises || workoutExercises.length === 0) return [];
      const exerciseIds = workoutExercises.map((e) => e.id);
      const { data, error } = await supabase
        .from('workout_sets')
        .select('*')
        .in('workout_exercise_id', exerciseIds)
        .order('set_number', { ascending: true });
      if (error) throw error;
      return (data ?? []) as WorkoutSet[];
    },
    enabled: !!workoutExercises && workoutExercises.length > 0,
  });

  // Timer
  useEffect(() => {
    if (session?.status !== 'in_progress') return;
    const startTime = new Date(session.started_at).getTime();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [session]);

  // Fetch previous performance for each exercise
  useEffect(() => {
    if (!user || !workoutExercises) return;
    workoutExercises.forEach(async (ex) => {
      if (!ex.exercise_id) return;
      const { data } = await supabase
        .from('workout_sets')
        .select('weight_kg, reps, workout_exercise!inner(session_id)')
        .eq('workout_exercise.exercise_id', ex.exercise_id)
        .neq('workout_exercise.session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(1);
      if (data && data.length > 0) {
        setPrevPerformance((prev) => ({
          ...prev,
          [ex.id]: { weight: Number(data[0].weight_kg) || 0, reps: data[0].reps || 0 },
        }));
      }
    });
  }, [user, workoutExercises, sessionId]);

  const addExerciseMutation = useMutation({
    mutationFn: async (exercise: ExerciseDefinition) => {
      const orderIndex = workoutExercises?.length ?? 0;
      const { error } = await supabase.from('workout_exercises').insert({
        session_id: sessionId,
        exercise_id: exercise.id,
        exercise_name: exercise.name,
        order_index: orderIndex,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      refetchExercises();
      setAddExerciseOpen(false);
      setExerciseSearch('');
      toast.success('Exercise added');
    },
    onError: (err) => toast.error(err.message),
  });

  const addSetMutation = useMutation({
    mutationFn: async (workoutExerciseId: string) => {
      const currentSets = sets?.filter((s) => s.workout_exercise_id === workoutExerciseId) ?? [];
      const setNumber = currentSets.length + 1;
      const { error } = await supabase.from('workout_sets').insert({
        workout_exercise_id: workoutExerciseId,
        set_number: setNumber,
        weight_kg: 0,
        reps: 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      refetchSets();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateSetMutation = useMutation({
    mutationFn: async ({ setId, field, value }: { setId: string; field: string; value: number | null }) => {
      const { error } = await supabase
        .from('workout_sets')
        .update({ [field]: value })
        .eq('id', setId);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchSets();
    },
  });

  const deleteSetMutation = useMutation({
    mutationFn: async (setId: string) => {
      const { error } = await supabase.from('workout_sets').delete().eq('id', setId);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchSets();
    },
  });

  const deleteExerciseMutation = useMutation({
    mutationFn: async (exerciseId: string) => {
      const { error } = await supabase.from('workout_exercises').delete().eq('id', exerciseId);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchExercises();
      toast.success('Exercise removed');
    },
  });

  const finishWorkoutMutation = useMutation({
    mutationFn: async () => {
      // Calculate total volume
      const totalVolume = (sets ?? []).reduce((sum, s) => sum + (Number(s.weight_kg) || 0) * (s.reps || 0), 0);
      const duration = session ? Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000) : 0;

      const { error } = await supabase
        .from('workout_sessions')
        .update({
          status: 'completed',
          ended_at: new Date().toISOString(),
          duration_seconds: duration,
          total_volume_kg: totalVolume,
        })
        .eq('id', sessionId);
      if (error) throw error;

      // Detect PRs
      if (user && workoutExercises && sets) {
        for (const ex of workoutExercises) {
          const exSets = sets.filter((s) => s.workout_exercise_id === ex.id);
          const maxWeight = Math.max(...exSets.map((s) => Number(s.weight_kg) || 0), 0);
          if (maxWeight > 0 && ex.exercise_id) {
            // Check if this is a new PR
            const { data: existingPR } = await supabase
              .from('personal_records')
              .select('value')
              .eq('user_id', user.id)
              .eq('exercise_id', ex.exercise_id)
              .eq('record_type', 'max_weight')
              .maybeSingle();
            if (!existingPR || maxWeight > Number(existingPR.value)) {
              await supabase.from('personal_records').insert({
                user_id: user.id,
                exercise_id: ex.exercise_id,
                exercise_name: ex.exercise_name,
                record_type: 'max_weight',
                value: maxWeight,
                workout_session_id: sessionId,
                date: format(new Date(), 'yyyy-MM-dd'),
              });
              toast.success(`New PR: ${ex.exercise_name} — ${maxWeight}kg!`, { icon: '🏆' });
            }
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recent-workouts'] });
      queryClient.invalidateQueries({ queryKey: ['in-progress-workout'] });
      queryClient.invalidateQueries({ queryKey: ['today-workouts'] });
      queryClient.invalidateQueries({ queryKey: ['personal-records'] });
      toast.success('Workout completed! Great work.');
      router.push('/workouts');
    },
    onError: (err) => toast.error(err.message),
  });

  const filteredExercises = exercises?.filter((e) =>
    e.name.toLowerCase().includes(exerciseSearch.toLowerCase())
  ) ?? [];

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
  };

  const isCompleted = session?.status === 'completed';

  if (!session) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/workouts')}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">{session.name}</h1>
            <p className="text-sm text-muted-foreground">
              {format(new Date(session.started_at), 'EEEE, MMMM d · HH:mm')}
              {!isCompleted && <span className="ml-2 font-mono text-primary">{formatTime(elapsed)}</span>}
              {isCompleted && session.duration_seconds && ` · ${Math.round(session.duration_seconds / 60)} min`}
            </p>
          </div>
        </div>
        {!isCompleted && (
          <Button onClick={() => finishWorkoutMutation.mutate()} disabled={finishWorkoutMutation.isPending} className="gap-2 bg-success hover:bg-success/90">
            {finishWorkoutMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Finish Workout
          </Button>
        )}
      </div>

      {/* Total volume */}
      {isCompleted && (
        <Card className="border-border/50 bg-primary/5">
          <CardContent className="py-4 flex items-center justify-around">
            <div className="text-center">
              <p className="text-2xl font-bold">{Math.round(Number(session.total_volume_kg)).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Total Volume (kg)</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{workoutExercises?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">Exercises</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{sets?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">Total Sets</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Exercises */}
      <div className="space-y-4">
        {workoutExercises?.map((ex) => {
          const exSets = sets?.filter((s) => s.workout_exercise_id === ex.id) ?? [];
          const prev = prevPerformance[ex.id];
          const exVolume = exSets.reduce((sum, s) => sum + (Number(s.weight_kg) || 0) * (s.reps || 0), 0);
          return (
            <Card key={ex.id} className="border-border/50">
              <CardContent className="pt-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold">{ex.exercise_name}</h3>
                    {prev && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" /> Previous: {prev.weight}kg × {prev.reps}
                      </p>
                    )}
                    {exVolume > 0 && (
                      <p className="text-xs text-primary mt-0.5">Volume: {Math.round(exVolume).toLocaleString()} kg</p>
                    )}
                  </div>
                  {!isCompleted && (
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => deleteExerciseMutation.mutate(ex.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                {/* Sets table */}
                {exSets.length > 0 ? (
                  <div className="space-y-1">
                    <div className="grid grid-cols-12 gap-2 text-xs text-muted-foreground px-2 pb-1">
                      <div className="col-span-1 text-center">#</div>
                      <div className="col-span-5">Weight (kg)</div>
                      <div className="col-span-4">Reps</div>
                      <div className="col-span-2"></div>
                    </div>
                    {exSets.map((set) => (
                      <div key={set.id} className="grid grid-cols-12 gap-2 items-center p-1.5 rounded-lg hover:bg-accent group">
                        <div className="col-span-1 text-center text-sm font-medium">{set.set_number}</div>
                        <div className="col-span-5">
                          {isCompleted ? (
                            <span className="text-sm">{Number(set.weight_kg) || 0}</span>
                          ) : (
                            <Input
                              type="number"
                              step="0.5"
                              value={Number(set.weight_kg) || ''}
                              onChange={(e) => {
                                updateSetMutation.mutate({ setId: set.id, field: 'weight_kg', value: e.target.value ? parseFloat(e.target.value) : null });
                              }}
                              className="h-8 text-sm"
                              placeholder="0"
                            />
                          )}
                        </div>
                        <div className="col-span-4">
                          {isCompleted ? (
                            <span className="text-sm">{set.reps || 0}</span>
                          ) : (
                            <Input
                              type="number"
                              value={set.reps || ''}
                              onChange={(e) => {
                                updateSetMutation.mutate({ setId: set.id, field: 'reps', value: e.target.value ? parseInt(e.target.value) : null });
                              }}
                              className="h-8 text-sm"
                              placeholder="0"
                            />
                          )}
                        </div>
                        <div className="col-span-2 flex justify-end">
                          {!isCompleted && (
                            <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => deleteSetMutation.mutate(set.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-2">No sets logged yet</p>
                )}

                {!isCompleted && (
                  <Button size="sm" variant="outline" className="w-full mt-2 gap-1" onClick={() => addSetMutation.mutate(ex.id)}>
                    <Plus className="h-3.5 w-3.5" /> Add Set
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}

        {/* Add exercise button */}
        {!isCompleted && (
          <Dialog open={addExerciseOpen} onOpenChange={setAddExerciseOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full gap-2 border-dashed">
                <Plus className="h-4 w-4" /> Add Exercise
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Exercise</DialogTitle>
              </DialogHeader>
              <Input placeholder="Search exercises..." value={exerciseSearch} onChange={(e) => setExerciseSearch(e.target.value)} className="mb-3" />
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {filteredExercises.map((ex) => (
                  <button
                    key={ex.id}
                    onClick={() => addExerciseMutation.mutate(ex)}
                    className="w-full text-left p-3 rounded-lg border border-border hover:border-primary/30 hover:bg-accent transition-colors"
                  >
                    <p className="font-medium text-sm">{ex.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{ex.category} · {ex.equipment} · {ex.primary_muscle}</p>
                  </button>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isCompleted && (
        <div className="text-center py-4">
          <Trophy className="h-10 w-10 text-warning mx-auto mb-2" />
          <p className="font-medium">Workout completed</p>
          <p className="text-sm text-muted-foreground">{format(new Date(session.started_at), 'EEEE, MMMM d')}</p>
        </div>
      )}
    </div>
  );
}

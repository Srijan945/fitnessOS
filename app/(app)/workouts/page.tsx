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
import { Dumbbell, Plus, Play, Trash2, Clock, Loader2, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import type { ExerciseDefinition, WorkoutTemplate, WorkoutSession } from '@/lib/supabase/types';

export default function WorkoutsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateExercises, setTemplateExercises] = useState<string[]>([]);
  const [exerciseSearch, setExerciseSearch] = useState('');

  const { data: templates } = useQuery({
    queryKey: ['workout-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workout_templates')
        .select('*, workout_template_exercises(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

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
    enabled: !!user,
  });

  const { data: recentSessions } = useQuery({
    queryKey: ['recent-workouts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('status', 'completed')
        .order('started_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as WorkoutSession[];
    },
    enabled: !!user,
  });

  const { data: inProgressSession } = useQuery({
    queryKey: ['in-progress-workout'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('status', 'in_progress')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as WorkoutSession | null;
    },
    enabled: !!user,
  });

  const createTemplateMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { data: template, error: tError } = await supabase
        .from('workout_templates')
        .insert({ user_id: user.id, name: templateName })
        .select()
        .single();
      if (tError) throw tError;

      const exerciseData = templateExercises.map((exId, i) => {
        const ex = exercises?.find((e) => e.id === exId);
        return {
          template_id: template.id,
          exercise_id: exId,
          exercise_name: ex?.name ?? 'Unknown',
          target_sets: 3,
          rep_range_min: 8,
          rep_range_max: 12,
          rest_seconds: 90,
          order_index: i,
        };
      });
      if (exerciseData.length > 0) {
        const { error: eError } = await supabase.from('workout_template_exercises').insert(exerciseData);
        if (eError) throw eError;
      }
      return template;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workout-templates'] });
      toast.success('Template created');
      setTemplateDialogOpen(false);
      setTemplateName('');
      setTemplateExercises([]);
    },
    onError: (err) => toast.error(err.message),
  });

  const startWorkoutMutation = useMutation({
    mutationFn: async (templateId: string | undefined) => {
      if (!user) return;
      let name = 'Free-form Workout';
      if (templateId) {
        const template = templates?.find((t) => t.id === templateId);
        name = template?.name ?? 'Template Workout';
      }
      const { data: session, error } = await supabase
        .from('workout_sessions')
        .insert({
          user_id: user.id,
          template_id: templateId ?? null,
          name,
          status: 'in_progress',
        })
        .select()
        .single();
      if (error) throw error;

      // If from template, copy exercises
      if (templateId) {
        const template = templates?.find((t) => t.id === templateId);
        if (template?.workout_template_exercises) {
          const exInserts = template.workout_template_exercises.map((te: { exercise_id: string | null; exercise_name: string; order_index: number }, i: number) => ({
            session_id: session.id,
            exercise_id: te.exercise_id,
            exercise_name: te.exercise_name,
            order_index: i,
          }));
          if (exInserts.length > 0) {
            const { error: weError } = await supabase.from('workout_exercises').insert(exInserts);
            if (weError) throw weError;
          }
        }
      }
      return session;
    },
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: ['in-progress-workout'] });
      queryClient.invalidateQueries({ queryKey: ['today-workouts'] });
      router.push(`/workouts/${session.id}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const filteredExercises = exercises?.filter((e) =>
    e.name.toLowerCase().includes(exerciseSearch.toLowerCase())
  ) ?? [];

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Workouts</h1>
          <p className="text-sm text-muted-foreground">Track your training sessions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => startWorkoutMutation.mutate(undefined)}>
            {startWorkoutMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            Free-form
          </Button>
          <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> New Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Workout Template</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Template Name</Label>
                  <Input placeholder="e.g. Push A, Pull B, Legs A" value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Add Exercises</Label>
                  <Input placeholder="Search exercises..." value={exerciseSearch} onChange={(e) => setExerciseSearch(e.target.value)} />
                  <div className="max-h-48 overflow-y-auto space-y-1 border rounded-lg p-2">
                    {filteredExercises.map((ex) => (
                      <button
                        key={ex.id}
                        onClick={() => {
                          if (!templateExercises.includes(ex.id)) {
                            setTemplateExercises([...templateExercises, ex.id]);
                          }
                        }}
                        disabled={templateExercises.includes(ex.id)}
                        className="w-full text-left p-2 rounded text-sm hover:bg-accent disabled:opacity-40 transition-colors"
                      >
                        <span className="font-medium">{ex.name}</span>
                        <span className="text-xs text-muted-foreground ml-2 capitalize">{ex.category} · {ex.equipment}</span>
                      </button>
                    ))}
                  </div>
                </div>
                {templateExercises.length > 0 && (
                  <div className="space-y-1">
                    <Label>Selected ({templateExercises.length})</Label>
                    {templateExercises.map((exId, i) => {
                      const ex = exercises?.find((e) => e.id === exId);
                      return (
                        <div key={exId} className="flex items-center justify-between p-2 rounded bg-secondary/50">
                          <span className="text-sm">{i + 1}. {ex?.name ?? 'Unknown'}</span>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setTemplateExercises(templateExercises.filter((id) => id !== exId))}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button onClick={() => createTemplateMutation.mutate()} disabled={!templateName || createTemplateMutation.isPending} className="gap-2">
                  {createTemplateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Create Template
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* In-progress workout banner */}
      {inProgressSession && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="pt-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/10">
                <Clock className="h-5 w-5 text-warning animate-pulse" />
              </div>
              <div>
                <p className="font-medium">{inProgressSession.name}</p>
                <p className="text-xs text-muted-foreground">Workout in progress — tap to resume</p>
              </div>
            </div>
            <Button onClick={() => router.push(`/workouts/${inProgressSession.id}`)}>Resume</Button>
          </CardContent>
        </Card>
      )}

      {/* Templates */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Templates</h2>
        {templates && templates.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {templates.map((template: { id: string; name: string; notes: string | null; workout_template_exercises: { exercise_name: string }[] }) => (
              <Card key={template.id} className="border-border/50 hover:border-primary/30 transition-colors group">
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                        <Dumbbell className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{template.name}</p>
                        <p className="text-xs text-muted-foreground">{template.workout_template_exercises?.length ?? 0} exercises</p>
                      </div>
                    </div>
                  </div>
                  {template.workout_template_exercises && template.workout_template_exercises.length > 0 && (
                    <div className="space-y-1 mb-3">
                      {template.workout_template_exercises.slice(0, 4).map((ex: { exercise_name: string }, i: number) => (
                        <p key={i} className="text-xs text-muted-foreground">• {ex.exercise_name}</p>
                      ))}
                      {template.workout_template_exercises.length > 4 && (
                        <p className="text-xs text-muted-foreground">+ {template.workout_template_exercises.length - 4} more</p>
                      )}
                    </div>
                  )}
                  <Button size="sm" className="w-full gap-2 mt-2" onClick={() => startWorkoutMutation.mutate(template.id)}>
                    <Play className="h-3.5 w-3.5" /> Start Workout
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-border/50 border-dashed">
            <CardContent className="py-12 text-center">
              <Dumbbell className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium">No templates yet</p>
              <p className="text-xs text-muted-foreground mt-1">Create a workout template or start a free-form workout.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recent sessions */}
      {recentSessions && recentSessions.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Recent Workouts</h2>
          <div className="space-y-2">
            {recentSessions.map((session) => (
              <Card key={session.id} className="border-border/50">
                <CardContent className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                      <Dumbbell className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{session.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(session.started_at), 'MMM d, yyyy · HH:mm')}
                        {session.duration_seconds && ` · ${Math.round(session.duration_seconds / 60)} min`}
                        {Number(session.total_volume_kg) > 0 && ` · ${Math.round(Number(session.total_volume_kg)).toLocaleString()} kg volume`}
                      </p>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => router.push(`/workouts/${session.id}`)}>
                    View
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

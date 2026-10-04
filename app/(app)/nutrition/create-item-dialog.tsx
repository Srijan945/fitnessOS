'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export type CreateItemType = 'food' | 'meal' | 'recipe' | null;

interface Props {
  type: CreateItemType;
  onClose: () => void;
}

export function CreateItemDialog({ type, onClose }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Shared form states
  const [name, setName] = useState('');
  
  // Food specific states
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [servingSize, setServingSize] = useState('100');
  const [servingUnit, setServingUnit] = useState('g');
  
  // Recipe specific states
  const [servings, setServings] = useState('1');
  const [instructions, setInstructions] = useState('');

  // Meal specific states
  const [mealType, setMealType] = useState('breakfast');

  const createFoodMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not logged in");
      const { error } = await supabase.from('foods').insert({
        user_id: user.id,
        name,
        calories_per_serving: Number(calories),
        protein_g: Number(protein) || 0,
        carbs_g: Number(carbs) || 0,
        fat_g: Number(fat) || 0,
        serving_size: Number(servingSize) || 100,
        serving_unit: servingUnit,
        source: 'CUSTOM'
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Custom food created!');
      onClose();
    },
    onError: (e) => toast.error(e.message)
  });

  const createMealMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not logged in");
      const { error } = await supabase.from('meals').insert({
        user_id: user.id,
        name,
        meal_type: mealType
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meals'] });
      toast.success('Empty meal created! You can now log it and add items.');
      onClose();
    },
    onError: (e) => toast.error(e.message)
  });

  const createRecipeMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not logged in");
      const { error } = await supabase.from('recipes').insert({
        user_id: user.id,
        name,
        servings: Number(servings) || 1,
        instructions,
        total_calories: Number(calories) || 0,
        total_protein_g: Number(protein) || 0,
        total_carbs_g: Number(carbs) || 0,
        total_fat_g: Number(fat) || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      toast.success('Recipe created!');
      onClose();
    },
    onError: (e) => toast.error(e.message)
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (type === 'food') createFoodMutation.mutate();
    else if (type === 'meal') createMealMutation.mutate();
    else if (type === 'recipe') createRecipeMutation.mutate();
  };

  const isPending = createFoodMutation.isPending || createMealMutation.isPending || createRecipeMutation.isPending;

  return (
    <Dialog open={!!type} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {type === 'food' ? 'Create Custom Food' : type === 'meal' ? 'Create Meal Template' : 'Create Recipe'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. My Grandma's Lasagna" />
          </div>

          {type === 'meal' && (
            <div className="space-y-2">
              <Label>Default Meal Time</Label>
              <Select value={mealType} onValueChange={setMealType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="breakfast">Breakfast</SelectItem>
                  <SelectItem value="lunch">Lunch</SelectItem>
                  <SelectItem value="dinner">Dinner</SelectItem>
                  <SelectItem value="snack">Snack</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {type === 'recipe' && (
            <div className="space-y-2">
              <Label>Number of Servings</Label>
              <Input required type="number" min="1" value={servings} onChange={(e) => setServings(e.target.value)} />
            </div>
          )}

          {(type === 'food' || type === 'recipe') && (
            <>
              {type === 'food' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Serving Size</Label>
                    <Input required type="number" value={servingSize} onChange={(e) => setServingSize(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Unit</Label>
                    <Input required value={servingUnit} onChange={(e) => setServingUnit(e.target.value)} placeholder="g, ml, piece" />
                  </div>
                </div>
              )}
              
              <div className="space-y-2">
                <Label>Total Calories {type === 'recipe' && '(For entire recipe)'}</Label>
                <Input required type="number" value={calories} onChange={(e) => setCalories(e.target.value)} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Protein (g)</Label>
                  <Input type="number" value={protein} onChange={(e) => setProtein(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Carbs (g)</Label>
                  <Input type="number" value={carbs} onChange={(e) => setCarbs(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Fat (g)</Label>
                  <Input type="number" value={fat} onChange={(e) => setFat(e.target.value)} />
                </div>
              </div>
            </>
          )}

          {type === 'recipe' && (
            <div className="space-y-2">
              <Label>Instructions (Optional)</Label>
              <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} />
            </div>
          )}

          <Button type="submit" className="w-full mt-4" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save {type}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

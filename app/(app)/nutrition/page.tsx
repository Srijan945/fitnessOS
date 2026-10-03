'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Trash2, Loader2, ChevronLeft, ChevronRight, UtensilsCrossed } from 'lucide-react';
import { format, addDays, subDays } from 'date-fns';
import { toast } from 'sonner';
import type { Food, FoodEntry, MealType } from '@/lib/supabase/types';

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export default function NutritionPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Food[]>([]);
  const [searching, setSearching] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [quantity, setQuantity] = useState('100');
  const [unit, setUnit] = useState('g');
  const [mealType, setMealType] = useState<MealType>('breakfast');

  const { data: target } = useQuery({
    queryKey: ['daily-target', selectedDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_targets')
        .select('*')
        .lte('effective_date', selectedDate)
        .order('effective_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: entries } = useQuery({
    queryKey: ['food-entries', selectedDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('food_entries')
        .select('*')
        .eq('date', selectedDate)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as FoodEntry[];
    },
    enabled: !!user,
  });

  const { data: meals } = useQuery({
    queryKey: ['meals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meals')
        .select('*, meal_items(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: recipes } = useQuery({
    queryKey: ['recipes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recipes')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const searchFoods = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const { data, error } = await supabase
      .from('foods')
      .select('*')
      .ilike('name', `%${query}%`)
      .limit(20);
    if (error) {
      toast.error('Search failed');
    } else {
      setSearchResults((data ?? []) as Food[]);
    }
    setSearching(false);
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    const timeoutId = setTimeout(() => searchFoods(value), 300);
    return () => clearTimeout(timeoutId);
  };

  const addEntryMutation = useMutation({
    mutationFn: async () => {
      if (!user || !selectedFood) return;
      const qty = parseFloat(quantity);
      const ratio = qty / selectedFood.serving_size;
      const calories = Math.round(Number(selectedFood.calories_per_serving) * ratio);
      const protein = Math.round(Number(selectedFood.protein_g) * ratio * 10) / 10;
      const carbs = Math.round(Number(selectedFood.carbs_g) * ratio * 10) / 10;
      const fat = Math.round(Number(selectedFood.fat_g) * ratio * 10) / 10;
      const fiber = Math.round(Number(selectedFood.fiber_g) * ratio * 10) / 10;

      const { error } = await supabase.from('food_entries').insert({
        user_id: user.id,
        food_id: selectedFood.id,
        date: selectedDate,
        meal_type: mealType,
        quantity: qty,
        unit,
        food_name: selectedFood.name,
        calories,
        protein_g: protein,
        carbs_g: carbs,
        fat_g: fat,
        fiber_g: fiber,
        source: 'DATABASE',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['food-entries', selectedDate] });
      toast.success('Food logged');
      setAddDialogOpen(false);
      setSelectedFood(null);
      setSearchQuery('');
      setSearchResults([]);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteEntryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('food_entries').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['food-entries', selectedDate] });
      toast.success('Entry deleted');
    },
    onError: (err) => toast.error(err.message),
  });

  const logMealMutation = useMutation({
    mutationFn: async (meal: { id: string; meal_items: Record<string, number | string>[] }) => {
      if (!user) return;
      const entries = meal.meal_items.map((item) => ({
        user_id: user.id,
        date: selectedDate,
        meal_type: 'breakfast' as MealType,
        quantity: Number(item.quantity) || 100,
        unit: String(item.unit) || 'g',
        food_name: String(item.food_name),
        calories: Number(item.calories) || 0,
        protein_g: Number(item.protein_g) || 0,
        carbs_g: Number(item.carbs_g) || 0,
        fat_g: Number(item.fat_g) || 0,
        source: 'DATABASE' as const,
      }));
      const { error } = await supabase.from('food_entries').insert(entries);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['food-entries', selectedDate] });
      toast.success('Meal logged');
    },
    onError: (err) => toast.error(err.message),
  });

  const logRecipeMutation = useMutation({
    mutationFn: async (recipe: { id: string; name: string; servings: number; total_calories: number; total_protein_g: number; total_carbs_g: number; total_fat_g: number }) => {
      if (!user) return;
      const perServingCal = Number(recipe.total_calories) / recipe.servings;
      const perServingProtein = Number(recipe.total_protein_g) / recipe.servings;
      const perServingCarbs = Number(recipe.total_carbs_g) / recipe.servings;
      const perServingFat = Number(recipe.total_fat_g) / recipe.servings;
      const { error } = await supabase.from('food_entries').insert({
        user_id: user.id,
        date: selectedDate,
        meal_type: mealType,
        quantity: 1,
        unit: 'serving',
        food_name: recipe.name,
        calories: Math.round(perServingCal),
        protein_g: Math.round(perServingProtein * 10) / 10,
        carbs_g: Math.round(perServingCarbs * 10) / 10,
        fat_g: Math.round(perServingFat * 10) / 10,
        source: 'CUSTOM',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['food-entries', selectedDate] });
      toast.success('Recipe logged');
    },
    onError: (err) => toast.error(err.message),
  });

  const consumed = entries?.reduce((sum, e) => sum + Number(e.calories), 0) ?? 0;
  const consumedProtein = entries?.reduce((sum, e) => sum + Number(e.protein_g), 0) ?? 0;
  const consumedCarbs = entries?.reduce((sum, e) => sum + Number(e.carbs_g), 0) ?? 0;
  const consumedFat = entries?.reduce((sum, e) => sum + Number(e.fat_g), 0) ?? 0;
  const calorieTarget = target?.calorie_target ?? 0;

  const entriesByMeal = (mealType: MealType) => entries?.filter((e) => e.meal_type === mealType) ?? [];
  const mealCalories = (mealType: MealType) => entriesByMeal(mealType).reduce((sum, e) => sum + Number(e.calories), 0);

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Nutrition</h1>
          <p className="text-sm text-muted-foreground">{format(new Date(selectedDate), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        {/* Date selector */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setSelectedDate(format(subDays(new Date(selectedDate), 1), 'yyyy-MM-dd'))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-auto"
          />
          <Button variant="outline" size="icon" onClick={() => setSelectedDate(format(addDays(new Date(selectedDate), 1), 'yyyy-MM-dd'))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary card */}
      <Card className="border-border/50">
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold">{Math.round(consumed)}</p>
              <p className="text-xs text-muted-foreground">of {calorieTarget} kcal</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{Math.round(consumedProtein)}g</p>
              <p className="text-xs text-muted-foreground">Protein</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{Math.round(consumedCarbs)}g</p>
              <p className="text-xs text-muted-foreground">Carbs</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{Math.round(consumedFat)}g</p>
              <p className="text-xs text-muted-foreground">Fat</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add Food Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogTrigger asChild>
          <Button className="w-full gap-2" size="lg">
            <Plus className="h-5 w-5" /> Add Food
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Food</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="search">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="search">Search</TabsTrigger>
              <TabsTrigger value="meals">Meals</TabsTrigger>
              <TabsTrigger value="recipes">Recipes</TabsTrigger>
            </TabsList>

            {/* Food Search Tab */}
            <TabsContent value="search" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Search Foods</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search for food..."
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {searching && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}

              {!searching && searchResults.length > 0 && (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {searchResults.map((food) => (
                    <button
                      key={food.id}
                      onClick={() => setSelectedFood(food)}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        selectedFood?.id === food.id
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                          : 'border-border hover:border-primary/30 hover:bg-accent'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{food.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {food.serving_size}{food.serving_unit} · {Math.round(Number(food.calories_per_serving))} kcal · {Number(food.protein_g)}g protein
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">No foods found. Try a different search.</p>
              )}

              {/* Quantity selector */}
              {selectedFood && (
                <div className="p-4 rounded-lg border border-primary/20 bg-primary/5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{selectedFood.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {Math.round(Number(selectedFood.calories_per_serving))} kcal per {selectedFood.serving_size}{selectedFood.serving_unit}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Quantity</Label>
                      <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Unit</Label>
                      <Select value={unit} onValueChange={setUnit}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="g">grams</SelectItem>
                          <SelectItem value="ml">milliliters</SelectItem>
                          <SelectItem value="piece">pieces</SelectItem>
                          <SelectItem value="serving">servings</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Meal</Label>
                      <Select value={mealType} onValueChange={(v) => setMealType(v as MealType)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {MEAL_TYPES.map((m) => (
                            <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {/* Preview */}
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="p-2 rounded bg-secondary/50">
                      <p className="font-semibold text-sm">{Math.round(Number(selectedFood.calories_per_serving) * (parseFloat(quantity) / selectedFood.serving_size))}</p>
                      <p className="text-muted-foreground">kcal</p>
                    </div>
                    <div className="p-2 rounded bg-secondary/50">
                      <p className="font-semibold text-sm">{(Number(selectedFood.protein_g) * (parseFloat(quantity) / selectedFood.serving_size)).toFixed(1)}g</p>
                      <p className="text-muted-foreground">Protein</p>
                    </div>
                    <div className="p-2 rounded bg-secondary/50">
                      <p className="font-semibold text-sm">{(Number(selectedFood.carbs_g) * (parseFloat(quantity) / selectedFood.serving_size)).toFixed(1)}g</p>
                      <p className="text-muted-foreground">Carbs</p>
                    </div>
                    <div className="p-2 rounded bg-secondary/50">
                      <p className="font-semibold text-sm">{(Number(selectedFood.fat_g) * (parseFloat(quantity) / selectedFood.serving_size)).toFixed(1)}g</p>
                      <p className="text-muted-foreground">Fat</p>
                    </div>
                  </div>
                  <Button onClick={() => addEntryMutation.mutate()} disabled={addEntryMutation.isPending} className="w-full gap-2">
                    {addEntryMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Add Food
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* Meals Tab */}
            <TabsContent value="meals" className="space-y-3 mt-4">
              {meals && meals.length > 0 ? (
                meals.map((meal: { id: string; name: string; meal_items: { food_name: string; calories: number }[] }) => {
                  const totalCal = meal.meal_items?.reduce((s: number, i: { calories: number }) => s + Number(i.calories), 0) ?? 0;
                  return (
                    <div key={meal.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent transition-colors">
                      <div>
                        <p className="font-medium text-sm">{meal.name}</p>
                        <p className="text-xs text-muted-foreground">{meal.meal_items?.length ?? 0} items · {Math.round(totalCal)} kcal</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => logMealMutation.mutate(meal as unknown as { id: string; meal_items: Record<string, number | string>[] })}>
                        Log
                      </Button>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8">
                  <UtensilsCrossed className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No saved meals yet.</p>
                  <p className="text-xs text-muted-foreground mt-1">Save a meal from your food entries to reuse later.</p>
                </div>
              )}
            </TabsContent>

            {/* Recipes Tab */}
            <TabsContent value="recipes" className="space-y-3 mt-4">
              {recipes && recipes.length > 0 ? (
                recipes.map((recipe: { id: string; name: string; servings: number; total_calories: number; total_protein_g: number; total_carbs_g: number; total_fat_g: number }) => (
                  <div key={recipe.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent transition-colors">
                    <div>
                      <p className="font-medium text-sm">{recipe.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {recipe.servings} servings · {Math.round(Number(recipe.total_calories) / recipe.servings)} kcal/serving
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => logRecipeMutation.mutate(recipe)}>
                      Log
                    </Button>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <UtensilsCrossed className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No recipes yet.</p>
                  <p className="text-xs text-muted-foreground mt-1">Create recipes to easily log multi-ingredient meals.</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Meal sections */}
      <div className="space-y-4">
        {MEAL_TYPES.map((meal) => {
          const mealEntries = entriesByMeal(meal);
          const cal = mealCalories(meal);
          return (
            <Card key={meal} className="border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base capitalize">{meal}</CardTitle>
                  <span className="text-sm text-muted-foreground">{Math.round(cal)} kcal</span>
                </div>
              </CardHeader>
              <CardContent>
                {mealEntries.length === 0 ? (
                  <button
                    onClick={() => {
                      setMealType(meal);
                      setAddDialogOpen(true);
                    }}
                    className="w-full py-4 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-2 rounded-lg hover:bg-accent"
                  >
                    <Plus className="h-4 w-4" /> Add food to {meal}
                  </button>
                ) : (
                  <div className="space-y-2">
                    {mealEntries.map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-accent group">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{entry.food_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {entry.quantity}{entry.unit} · {Math.round(Number(entry.calories))} kcal · P{Math.round(Number(entry.protein_g))}g C{Math.round(Number(entry.carbs_g))}g F{Math.round(Number(entry.fat_g))}g
                          </p>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7"
                          onClick={() => deleteEntryMutation.mutate(entry.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                    <button
                      onClick={() => {
                        setMealType(meal);
                        setAddDialogOpen(true);
                      }}
                      className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1"
                    >
                      <Plus className="h-3 w-3" /> Add more
                    </button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

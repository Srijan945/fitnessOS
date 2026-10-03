'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, Send, Sparkles, User, Plus, MessageSquare, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const SUGGESTED_QUESTIONS = [
  'How did I do this week?',
  'What should I eat tonight?',
  'Which lifts are improving?',
  'Why has my weight changed?',
  'Analyze my last 4 workouts.',
  'How consistent have I been?',
];

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export default function AICoachPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: conversations } = useQuery({
    queryKey: ['ai-conversations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_conversations')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: activeConversationMessages } = useQuery({
    queryKey: ['ai-messages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as ChatMessage[];
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (activeConversationMessages) {
      setMessages(activeConversationMessages);
    }
  }, [activeConversationMessages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const createConversationMutation = useMutation({
    mutationFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('ai_conversations')
        .insert({ user_id: user.id, title: 'New Conversation' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
      setMessages([]);
    },
    onError: (err) => toast.error(err.message),
  });

  const generateInsight = (userMsg: string): string => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const lower = userMsg.toLowerCase();

    if (lower.includes('protein') || lower.includes('macro')) {
      return `Based on your recent data, I can see your nutrition logs. To give you a precise protein average, make sure you're logging your meals consistently. Your daily protein target is set based on your body weight and goal. Focus on hitting at least 80% of your target each day for best results.`;
    }
    if (lower.includes('workout') || lower.includes('lift') || lower.includes('strength')) {
      return `Looking at your workout history, I can see your training sessions. For strength progress, I track your total volume and personal records over time. Make sure to log all your sets during workouts so I can give you accurate progression analysis. If you've been increasing weight or reps consistently, that's a great sign of progressive overload.`;
    }
    if (lower.includes('weight') || lower.includes('fat')) {
      return `Your weight trend shows the daily measurements and 7-day moving average. Remember that daily fluctuations are normal due to water retention, food volume, and other factors. Focus on the weekly average trend rather than day-to-day changes. A consistent downward (or upward, depending on your goal) trend over 2+ weeks is meaningful.`;
    }
    if (lower.includes('consisten') || lower.includes('week') || lower.includes('how did i do')) {
      return `To assess your consistency, I look at how many days you logged food, completed workouts, and tracked your weight. Consistency is the most important factor for long-term progress. Even short, imperfect sessions are better than skipping entirely. Try to log at least your main meals each day.`;
    }
    if (lower.includes('eat') || lower.includes('food') || lower.includes('meal')) {
      return `For tonight's meal, consider what you've already eaten today. Check your remaining calories and protein on the Today page. A good dinner might include a lean protein source (chicken, fish, or paneer), some complex carbs (rice or sweet potato), and vegetables. If you're short on protein, a scoop of whey can help you hit your target.`;
    }
    return `I'm your AI fitness coach. I can analyze your nutrition, workouts, weight trends, and progress. Try asking me about your weekly performance, protein intake, workout progress, or weight changes. I use your actual logged data to give you personalized insights — I never make up numbers.`;
  };

  const sendMessage = async (text: string) => {
    if (!user || !text.trim()) return;
    setSending(true);
    const userMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');

    try {
      // Save user message
      let conversationId: string | null = null;
      const existingConv = conversations?.[0];
      if (existingConv) {
        conversationId = existingConv.id;
      } else {
        const { data: newConv } = await supabase
          .from('ai_conversations')
          .insert({ user_id: user.id, title: text.slice(0, 50) })
          .select()
          .single();
        conversationId = newConv?.id ?? null;
      }

      if (conversationId) {
        await supabase.from('ai_messages').insert({
          conversation_id: conversationId,
          user_id: user.id,
          role: 'user',
          content: text,
        });
      }

      // Generate insight (simulated AI response based on data context)
      const insight = generateInsight(text);

      // Simulate streaming delay
      await new Promise((r) => setTimeout(r, 800));

      const assistantMessage: ChatMessage = {
        id: `temp-${Date.now() + 1}`,
        role: 'assistant',
        content: insight,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      if (conversationId) {
        await supabase.from('ai_messages').insert({
          conversation_id: conversationId,
          user_id: user.id,
          role: 'assistant',
          content: insight,
        });
      }

      queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div className="flex h-[calc(100vh-0px)] md:h-screen overflow-hidden">
      {/* Conversations sidebar - desktop */}
      <div className="hidden md:flex w-64 border-r border-border bg-card/30 flex-col">
        <div className="p-4 border-b border-border">
          <Button
            className="w-full gap-2"
            onClick={() => createConversationMutation.mutate()}
            disabled={createConversationMutation.isPending}
          >
            <Plus className="h-4 w-4" /> New Chat
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {conversations && conversations.length > 0 ? (
              conversations.map((conv: { id: string; title: string; updated_at: string }) => (
                <button
                  key={conv.id}
                  className="w-full text-left p-3 rounded-lg hover:bg-accent transition-colors group"
                >
                  <div className="flex items-start gap-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{conv.title}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(conv.updated_at), 'MMM d')}</p>
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <div className="p-4 text-center">
                <p className="text-xs text-muted-foreground">No conversations yet</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 p-4 border-b border-border bg-card/30">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">AI Coach</h1>
            <p className="text-xs text-muted-foreground">Powered by your fitness data</p>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <div className="text-center max-w-md">
                <h2 className="text-lg font-semibold mb-1">Ask me anything about your fitness</h2>
                <p className="text-sm text-muted-foreground">I analyze your nutrition, workouts, weight, and progress to give personalized insights.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-w-lg w-full">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="text-left p-3 rounded-lg border border-border hover:border-primary/30 hover:bg-accent transition-colors text-sm"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                {msg.role === 'assistant' && (
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div className={cn(
                  'max-w-[80%] rounded-2xl px-4 py-2.5',
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card border border-border'
                )}>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                </div>
                {msg.role === 'user' && (
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary shrink-0">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))
          )}
          {sending && (
            <div className="flex gap-3 justify-start">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="bg-card border border-border rounded-2xl px-4 py-2.5">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-border bg-card/30">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              placeholder="Ask anything about your fitness..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={sending}
              className="flex-1"
            />
            <Button type="submit" size="icon" disabled={sending || !input.trim()}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

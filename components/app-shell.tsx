'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { supabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Activity, LayoutDashboard, Utensils, Dumbbell, TrendingUp, BarChart3, Bot, Settings, LogOut, Menu } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/today', label: 'Today', icon: LayoutDashboard },
  { href: '/nutrition', label: 'Nutrition', icon: Utensils },
  { href: '/workouts', label: 'Workouts', icon: Dumbbell },
  { href: '/progress', label: 'Progress', icon: TrendingUp },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/ai-coach', label: 'AI Coach', icon: Bot },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, profile } = useAuth();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success('Signed out');
    router.push('/login');
  };

  const Sidebar = (
    <aside className="flex flex-col h-full w-60 border-r border-border bg-card/50 backdrop-blur-sm">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
          <Activity className="h-4 w-4 text-primary" />
        </div>
        <span className="font-bold text-lg tracking-tight">FitOS</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                isActive
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent border border-transparent'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold">
            {user?.email?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.email}</p>
            <p className="text-xs text-muted-foreground capitalize">{profile?.activity_level?.replace('_', ' ') ?? 'Member'}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleSignOut} className="w-full mt-1 text-muted-foreground hover:text-foreground">
          <LogOut className="h-4 w-4 mr-2" /> Sign out
        </Button>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">{Sidebar}</div>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <div className="relative animate-fade-in">{Sidebar}</div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between h-14 px-4 border-b border-border bg-card/50 backdrop-blur-sm">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <span className="font-bold">FitOS</span>
          </div>
          <div className="w-9" />
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

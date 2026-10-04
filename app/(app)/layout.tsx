'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { AppShell } from '@/components/app-shell';
import { Activity } from 'lucide-react';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [showSplash, setShowSplash] = useState(true);

  // Intentional 1.5s splash screen
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!loading && !showSplash) {
      if (!user) {
        router.push('/login');
      } else if (user && !profile?.onboarding_completed) {
        router.push('/onboarding');
      }
    }
  }, [user, profile, loading, showSplash, router]);

  if (loading || showSplash || !user || !profile?.onboarding_completed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-transparent backdrop-blur-md z-50">
        <div className="relative flex items-center justify-center animate-pulse duration-1000">
          {/* Outer glowing rings */}
          <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl scale-150" />
          <div className="absolute inset-0 rounded-full bg-primary/40 blur-md scale-110" />
          
          {/* Logo Box */}
          <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 border border-primary/30 shadow-[0_0_40px_rgba(var(--primary),0.3)] glass">
            <Activity className="h-10 w-10 text-primary" />
          </div>
        </div>
        <div className="mt-8 space-y-2 text-center animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300 fill-mode-both">
          <h2 className="text-2xl font-bold tracking-tight text-white drop-shadow-md">FitOS</h2>
          <p className="text-sm text-gray-300 font-medium">Preparing your workspace...</p>
        </div>
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}

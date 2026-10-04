import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/lib/auth/auth-context';
import { QueryProvider } from '@/lib/query/query-provider';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from '@/components/theme-provider';
import { ThemeToggle } from '@/components/theme-toggle';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'FitOS — Your Personal Fitness Operating System',
  description: 'Track nutrition, workouts, progress, and get AI-powered insights. A complete fitness operating system.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} text-foreground antialiased min-h-screen relative`}>
        {/* Global Background Image with Heavy Dark Gradient Overlay */}
        <div 
          className="fixed inset-0 z-[-1] bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=2940&auto=format&fit=crop')" }}
        >
          {/* Made the overlay more transparent to make the image more visible */}
          <div className="absolute inset-0 bg-background/70 sm:bg-background/50 bg-gradient-to-t from-background via-background/70 to-background/30" />
        </div>
        
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <QueryProvider>
              <ThemeToggle />
              {children}
              <Toaster />
            </QueryProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

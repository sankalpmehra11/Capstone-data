'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Props = { children: React.ReactNode };

export function AppShell({ children }: Props) {
  const [email, setEmail] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('darkMode');
    const nextDark = stored === '1';
    setDarkMode(nextDark);
    document.documentElement.classList.toggle('dark', nextDark);

    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const toggleDark = () => {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem('darkMode', next ? '1' : '0');
    document.documentElement.classList.toggle('dark', next);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b border-slate-200 bg-white/95 shadow-sm dark:border-slate-800 dark:bg-slate-900/95">
        <nav className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
          <div className="flex items-center gap-4 font-medium">
            <Link href="/">Home</Link>
            <Link href="/people">People</Link>
            <Link href="/active">Active</Link>
            <Link href="/tasks">Tasks</Link>
            <Link href="/settings">Settings</Link>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleDark} className="rounded border border-slate-300 px-2 py-1 dark:border-slate-600">
              {darkMode ? 'Light' : 'Dark'}
            </button>
            {email ? (
              <>
                <span className="hidden text-xs text-slate-500 sm:inline">{email}</span>
                <button
                  onClick={async () => {
                    await supabase.auth.signOut();
                    location.href = '/login';
                  }}
                  className="rounded bg-slate-900 px-2 py-1 text-white dark:bg-slate-100 dark:text-slate-900"
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link href="/login" className="rounded bg-blue-600 px-2 py-1 text-white">
                Sign in
              </Link>
            )}
          </div>
        </nav>
      </header>
      {children}
    </div>
  );
}

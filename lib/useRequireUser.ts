'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from './supabase';

export function useRequireUser(redirectTo = '/login') {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setUser(data.user ?? null);
      setLoading(false);
      if (!data.user) router.replace(redirectTo);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) router.replace(redirectTo);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [redirectTo, router]);

  return { user, loading };
}

'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) router.replace('/');
    });
  }, [router]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/` }
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage('Check your email for the magic link.');
    }
    setLoading(false);
  };

  return (
    <main className="mx-auto max-w-md p-4">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-slate-500">Use email magic link.</p>
        <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded border border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-950"
          />
          <button disabled={loading} className="w-full rounded bg-blue-600 p-2 text-white disabled:opacity-70">
            {loading ? 'Sending...' : 'Send magic link'}
          </button>
        </form>
        {message && <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{message}</p>}
      </section>
    </main>
  );
}

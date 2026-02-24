'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type DueTask = { id: string; title: string; due_date: string | null; person_id: string | null };
type DuePerson = { id: string; name: string; next_touch_date: string | null };

export default function HomePage() {
  const [tasks, setTasks] = useState<DueTask[]>([]);
  const [people, setPeople] = useState<DuePerson[]>([]);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      setSignedIn(true);
      const today = new Date().toISOString().slice(0, 10);

      const taskRes = await supabase
        .from('tasks')
        .select('id,title,due_date,person_id')
        .eq('status', 'open')
        .lte('due_date', today)
        .order('due_date', { ascending: true })
        .limit(20);

      const peopleRes = await supabase
        .from('people')
        .select('id,name,next_touch_date')
        .lte('next_touch_date', today)
        .order('next_touch_date', { ascending: true })
        .limit(20);

      setTasks((taskRes.data as DueTask[]) ?? []);
      setPeople((peopleRes.data as DuePerson[]) ?? []);
    };

    load();
  }, []);

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-2xl font-semibold">Personal CRM</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Track people, capture evidence, and stay on top of follow-ups.</p>
        {!signedIn && (
          <Link href="/login" className="mt-4 inline-block rounded bg-blue-600 px-4 py-2 text-white">Sign in to start</Link>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-semibold">Today: Tasks due</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {tasks.length ? tasks.map((task) => (
              <li key={task.id} className="rounded border border-slate-200 p-2 dark:border-slate-700">
                <p className="font-medium">{task.title}</p>
                <p className="text-slate-500">{task.due_date ?? 'No due date'} · {task.person_id ?? 'No person'}</p>
              </li>
            )) : <li className="text-slate-500">No due tasks.</li>}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-semibold">Today: People to touch</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {people.length ? people.map((person) => (
              <li key={person.id} className="rounded border border-slate-200 p-2 dark:border-slate-700">
                <p className="font-medium">{person.name}</p>
                <p className="text-slate-500">Next touch: {person.next_touch_date ?? 'Not set'}</p>
              </li>
            )) : <li className="text-slate-500">No follow-ups due.</li>}
          </ul>
        </div>
      </section>
    </main>
  );
}

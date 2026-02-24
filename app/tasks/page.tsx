'use client';

import { useEffect, useCallback, useState } from 'react';
import { taskToIcs } from '@/lib/ics';
import { supabase } from '@/lib/supabase';
import { useRequireUser } from '@/lib/useRequireUser';

type Task = { id: string; title: string; due_date: string | null; status: 'open' | 'done'; person_id: string | null };

export default function TasksPage() {
  const { user, loading } = useRequireUser();
  const [tasks, setTasks] = useState<Task[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    const res = await supabase.from('tasks').select('id,title,due_date,status,person_id').order('due_date', { ascending: true, nullsFirst: false });
    setTasks((res.data as Task[]) ?? []);
  }, [user]);

  useEffect(() => {
    if (!loading && user) load();
  }, [loading, user, load]);

  const exportIcs = (task: Task) => {
    if (!task.due_date) return;
    const content = taskToIcs(task.title, task.due_date, `Person: ${task.person_id ?? 'N/A'}`);
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${task.title.replace(/\s+/g, '-').toLowerCase()}.ics`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <main className="p-4">Loading...</main>;

  return (
    <main className="mx-auto max-w-5xl p-4">
      <h1 className="mb-4 text-xl font-semibold">Tasks</h1>
      <ul className="space-y-2">
        {tasks.map((task) => (
          <li key={task.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">{task.title}</p>
                <p className="text-sm text-slate-500">{task.due_date ?? 'No due'} · {task.status}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => supabase.from('tasks').update({ status: task.status === 'open' ? 'done' : 'open' }).eq('id', task.id).then(load)} className="rounded border px-2 py-1 text-sm">{task.status === 'open' ? 'Mark done' : 'Reopen'}</button>
                <button disabled={!task.due_date} onClick={() => exportIcs(task)} className="rounded bg-blue-600 px-2 py-1 text-sm text-white disabled:opacity-60">Add to Calendar (.ics)</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}

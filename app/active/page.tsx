'use client';

import { useEffect, useCallback, useState } from 'react';
import { PERSON_STATUSES, PersonStatus } from '@/lib/constants';
import { supabase } from '@/lib/supabase';
import { useRequireUser } from '@/lib/useRequireUser';

type Person = { id: string; name: string; status: PersonStatus; cadence_days: number; next_touch_date: string | null };

export default function ActivePage() {
  const { user, loading } = useRequireUser();
  const [status, setStatus] = useState<PersonStatus>('active');
  const [people, setPeople] = useState<Person[]>([]);

  const loadPeople = useCallback(async () => {
    if (!user) return;
    const res = await supabase.from('people').select('id,name,status,cadence_days,next_touch_date').eq('status', status).order('name');
    setPeople((res.data as Person[]) ?? []);
  }, [status, user]);

  useEffect(() => {
    if (!loading && user) loadPeople();
  }, [loading, user, loadPeople]);

  const patchPerson = async (id: string, patch: Partial<Person>) => {
    await supabase.from('people').update(patch).eq('id', id).eq('user_id', user?.id ?? '');
    await loadPeople();
  };

  if (loading) return <main className="p-4">Loading...</main>;

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-xl font-semibold">Relationship management</h1>
        <div className="mt-3 flex gap-2">
          {PERSON_STATUSES.map((value) => (
            <button key={value} onClick={() => setStatus(value)} className={`rounded border px-3 py-1 capitalize ${status === value ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : ''}`}>
              {value === 'hold' ? 'On Hold' : value}
            </button>
          ))}
        </div>
      </section>
      <ul className="space-y-2">
        {people.map((person) => (
          <li key={person.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="grid gap-2 md:grid-cols-5 md:items-center">
              <p className="font-medium md:col-span-1">{person.name}</p>
              <select defaultValue={person.status} onChange={(e) => patchPerson(person.id, { status: e.target.value as PersonStatus })} className="rounded border p-2 dark:border-slate-700 dark:bg-slate-950">
                {PERSON_STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <input type="number" defaultValue={person.cadence_days} onBlur={(e) => patchPerson(person.id, { cadence_days: Number(e.target.value) })} className="rounded border p-2 dark:border-slate-700 dark:bg-slate-950" />
              <input type="date" defaultValue={person.next_touch_date ?? ''} onBlur={(e) => patchPerson(person.id, { next_touch_date: e.target.value || null })} className="rounded border p-2 dark:border-slate-700 dark:bg-slate-950" />
              <button onClick={() => supabase.from('tasks').insert({ user_id: user?.id, person_id: person.id, title: `Follow up with ${person.name}`, due_date: person.next_touch_date, status: 'open' })} className="rounded bg-blue-600 px-3 py-2 text-white">Quick task</button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}

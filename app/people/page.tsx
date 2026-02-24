'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useCallback, useState } from 'react';
import { PERSON_STATUSES, PersonStatus } from '@/lib/constants';
import { supabase } from '@/lib/supabase';
import { useRequireUser } from '@/lib/useRequireUser';

type Person = { id: string; name: string; status: PersonStatus; next_touch_date: string | null; cadence_days: number };

export default function PeoplePage() {
  const { user, loading } = useRequireUser();
  const [people, setPeople] = useState<Person[]>([]);
  const [statusFilter, setStatusFilter] = useState<PersonStatus | 'all'>('all');
  const [name, setName] = useState('');

  const loadPeople = useCallback(async () => {
    if (!user) return;
    let query = supabase.from('people').select('id,name,status,next_touch_date,cadence_days').order('name');
    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
    const res = await query;
    setPeople((res.data as Person[]) ?? []);
  }, [statusFilter, user]);

  useEffect(() => {
    if (!loading && user) loadPeople();
  }, [loading, user, loadPeople]);

  const createPerson = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !name.trim()) return;
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || crypto.randomUUID();
    await supabase.from('people').upsert({
      id: slug,
      user_id: user.id,
      name: name.trim(),
      status: 'active',
      cadence_days: 30
    }, { onConflict: 'user_id,id' });
    setName('');
    await loadPeople();
  };

  if (loading) return <main className="p-4">Loading...</main>;

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-xl font-semibold">People</h1>
        <form onSubmit={createPerson} className="mt-3 flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add person name" className="flex-1 rounded border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-950" />
          <button className="rounded bg-blue-600 px-3 text-white">Add</button>
        </form>
        <div className="mt-3 flex gap-2 text-sm">
          <button onClick={() => setStatusFilter('all')} className="rounded border px-2 py-1">All</button>
          {PERSON_STATUSES.map((status) => (
            <button key={status} onClick={() => setStatusFilter(status)} className="rounded border px-2 py-1 capitalize">{status}</button>
          ))}
        </div>
      </section>

      <ul className="space-y-2">
        {people.map((person) => (
          <li key={person.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{person.name}</p>
                <p className="text-sm text-slate-500">{person.status} · cadence {person.cadence_days}d · next {person.next_touch_date ?? '—'}</p>
              </div>
              <Link href={`/people/${person.id}`} className="rounded bg-slate-900 px-3 py-1 text-sm text-white dark:bg-slate-100 dark:text-slate-900">Open</Link>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}

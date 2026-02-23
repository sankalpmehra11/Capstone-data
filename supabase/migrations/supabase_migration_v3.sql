-- Supabase migration v3: auth-ready CRM entities and constraints for Android + desktop workflows
create extension if not exists pgcrypto;

DO $$ BEGIN
  CREATE TYPE public.person_status AS ENUM ('active', 'hold', 'inactive');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.interaction_channel AS ENUM ('email', 'whatsapp', 'call', 'message', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.task_status AS ENUM ('open', 'done');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

create table if not exists public.people (
  id text not null,
  user_id uuid not null,
  name text not null,
  phone text,
  whatsapp_phone text,
  status public.person_status not null default 'active',
  cadence_days int not null default 30,
  last_contacted date,
  next_touch_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.interactions (
  id uuid primary key default gen_random_uuid(),
  person_id text not null,
  user_id uuid not null,
  occurred_at timestamptz not null default now(),
  channel public.interaction_channel not null default 'other',
  raw_capture text,
  summary text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  person_id text,
  title text not null,
  due_date date,
  status public.task_status not null default 'open',
  created_at timestamptz not null default now()
);

alter table public.people enable row level security;
alter table public.interactions enable row level security;
alter table public.tasks enable row level security;

DO $$ BEGIN
  create policy "people_user_owns_row" on public.people for all using (user_id = auth.uid()) with check (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  create policy "interactions_user_owns_row" on public.interactions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  create policy "tasks_user_owns_row" on public.tasks for all using (user_id = auth.uid()) with check (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Backfill/align existing schemas where older versions exist
alter table public.person_memory
  add column if not exists user_id uuid,
  add column if not exists person_id text,
  add column if not exists running_summary text not null default '',
  add column if not exists key_facts_json jsonb not null default '{"emails":[],"phoneNumbers":[],"companies":[],"nextActions":[],"dateMentions":[]}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

alter table public.person_memory drop constraint if exists person_memory_pkey;
alter table public.person_memory add primary key (user_id, person_id);

alter table public.interactions
  alter column channel type public.interaction_channel
  using (
    case
      when channel::text in ('sms', 'message') then 'message'::public.interaction_channel
      when channel::text = 'email' then 'email'::public.interaction_channel
      when channel::text = 'whatsapp' then 'whatsapp'::public.interaction_channel
      when channel::text = 'call' then 'call'::public.interaction_channel
      else 'other'::public.interaction_channel
    end
  );

alter table public.tasks
  alter column status type public.task_status
  using (
    case when status::text in ('done', 'open') then status::text::public.task_status else 'open'::public.task_status end
  );

create index if not exists idx_people_status_next_touch on public.people(status, next_touch_date);
create index if not exists idx_interactions_person_occurred on public.interactions(person_id, occurred_at desc);
create index if not exists idx_tasks_due_status on public.tasks(due_date, status);

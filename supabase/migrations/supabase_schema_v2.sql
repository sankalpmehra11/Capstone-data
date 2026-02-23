-- Evidence uploads
create table if not exists public.uploads (
  id uuid primary key default gen_random_uuid(),
  person_id text not null,
  user_id uuid not null,
  type text not null check (type in ('image', 'audio')),
  storage_path text not null,
  public_url text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.extractions (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid not null references public.uploads(id) on delete cascade,
  user_id uuid not null,
  extracted_text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.person_memory (
  person_id text primary key,
  user_id uuid not null,
  running_summary text not null default '',
  key_facts_json jsonb not null default '{"emails":[],"phoneNumbers":[],"companies":[],"nextActions":[],"dateMentions":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.uploads enable row level security;
alter table public.extractions enable row level security;
alter table public.person_memory enable row level security;

create policy "uploads_user_owns_row"
  on public.uploads
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "extractions_user_owns_row"
  on public.extractions
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "person_memory_user_owns_row"
  on public.person_memory
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists idx_uploads_person_created on public.uploads(person_id, created_at desc);
create index if not exists idx_extractions_upload on public.extractions(upload_id);
create index if not exists idx_person_memory_updated on public.person_memory(updated_at desc);

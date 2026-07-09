create extension if not exists pgcrypto;

create table if not exists public.vocabulary_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  term text not null,
  source_language text not null check (source_language in ('de', 'pt-BR')),
  target_language text not null check (target_language in ('de', 'pt-BR')),
  translation text not null,
  example_source text not null,
  example_target text,
  provider text not null default 'local' check (provider in ('local', 'public', 'deepl', 'openai')),
  created_at timestamptz not null default now(),
  due_at timestamptz not null default now(),
  last_reviewed_at timestamptz,
  repetitions integer not null default 0,
  interval_days integer not null default 0,
  ease_factor numeric(4, 2) not null default 2.50,
  lapses integer not null default 0,
  tags text[] not null default '{}'
);

create index if not exists vocabulary_entries_user_due_idx
  on public.vocabulary_entries(user_id, due_at);

create unique index if not exists vocabulary_entries_user_term_source_uidx
  on public.vocabulary_entries(user_id, lower(term), source_language);

alter table public.vocabulary_entries enable row level security;

create policy "Users can read their vocabulary"
  on public.vocabulary_entries for select
  using (auth.uid() = user_id);

create policy "Users can insert their vocabulary"
  on public.vocabulary_entries for insert
  with check (auth.uid() = user_id);

create policy "Users can update their vocabulary"
  on public.vocabulary_entries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their vocabulary"
  on public.vocabulary_entries for delete
  using (auth.uid() = user_id);

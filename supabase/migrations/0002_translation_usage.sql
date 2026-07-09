create table if not exists public.translation_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  provider text not null default 'openai',
  model text not null,
  term text not null,
  source_language text not null check (source_language in ('de', 'pt-BR')),
  target_language text not null check (target_language in ('de', 'pt-BR')),
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  total_tokens integer not null default 0,
  cost_usd numeric(12, 6) not null default 0
);

create index if not exists translation_usage_user_month_idx
  on public.translation_usage(user_id, created_at desc);

alter table public.translation_usage enable row level security;

create policy "Users can read their own translation usage"
  on public.translation_usage
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own translation usage"
  on public.translation_usage
  for insert
  with check (auth.uid() = user_id);

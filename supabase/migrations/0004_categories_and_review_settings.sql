alter table public.vocabulary_entries
  add column if not exists category text not null default 'Nomen',
  add column if not exists subcategory text not null default 'Allgemein';

create index if not exists vocabulary_entries_user_category_idx
  on public.vocabulary_entries(user_id, category, subcategory);

create table if not exists public.review_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  again_delay_minutes integer not null default 10,
  review_intervals_days integer[] not null default array[1, 3, 7, 14, 21, 60],
  easy_skip_steps integer not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.review_settings enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'review_settings'
      and policyname = 'Users can read their review settings'
  ) then
    create policy "Users can read their review settings"
      on public.review_settings
      for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'review_settings'
      and policyname = 'Users can insert their review settings'
  ) then
    create policy "Users can insert their review settings"
      on public.review_settings
      for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'review_settings'
      and policyname = 'Users can update their review settings'
  ) then
    create policy "Users can update their review settings"
      on public.review_settings
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

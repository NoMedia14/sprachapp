create table if not exists public.reference_lexicon_entries (
  id text primary key,
  language text not null check (language in ('pt-BR', 'en')),
  lemma text not null,
  normalized_lemma text not null,
  part_of_speech text not null,
  meaning text not null,
  translation text,
  cefr_level text not null check (cefr_level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'UNASSIGNED')),
  frequency_score numeric(4, 3) not null check (frequency_score >= 0 and frequency_score <= 1),
  dispersion_score numeric(4, 3) not null check (dispersion_score >= 0 and dispersion_score <= 1),
  classification_source text not null,
  confidence numeric(4, 3) not null check (confidence >= 0 and confidence <= 1),
  include_in_reference_lexicon boolean not null default true,
  version text not null,
  topics text[] not null default '{}',
  content_type text not null default 'word' check (content_type in ('word', 'phrase', 'sentence')),
  example_sentence text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz not null default now(),
  unique (language, version, normalized_lemma, part_of_speech, meaning)
);

create index if not exists reference_lexicon_entries_language_level_idx
  on public.reference_lexicon_entries(language, version, cefr_level);

create index if not exists reference_lexicon_entries_language_lemma_idx
  on public.reference_lexicon_entries(language, normalized_lemma);

alter table public.reference_lexicon_entries enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'reference_lexicon_entries'
      and policyname = 'Authenticated users can read reference lexicon'
  ) then
    create policy "Authenticated users can read reference lexicon"
      on public.reference_lexicon_entries
      for select
      to authenticated
      using (true);
  end if;
end $$;

create table if not exists public.reference_lexicon_imports (
  id uuid primary key default gen_random_uuid(),
  language text not null check (language in ('pt-BR', 'en')),
  version text not null,
  source_name text not null,
  license_status text not null,
  imported_entries integer not null default 0,
  rejected_entries integer not null default 0,
  confidence_threshold numeric(4, 3) not null default 0.75,
  notes text,
  created_at timestamptz not null default now(),
  unique (language, version)
);

alter table public.reference_lexicon_imports enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'reference_lexicon_imports'
      and policyname = 'Authenticated users can read reference import metadata'
  ) then
    create policy "Authenticated users can read reference import metadata"
      on public.reference_lexicon_imports
      for select
      to authenticated
      using (true);
  end if;
end $$;

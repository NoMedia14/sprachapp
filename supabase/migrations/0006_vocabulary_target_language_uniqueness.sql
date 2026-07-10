drop index if exists public.vocabulary_entries_user_term_source_uidx;

create unique index if not exists vocabulary_entries_user_term_source_target_uidx
  on public.vocabulary_entries(user_id, lower(term), source_language, target_language);

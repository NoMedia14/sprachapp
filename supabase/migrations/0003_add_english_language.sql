alter table public.vocabulary_entries
  drop constraint if exists vocabulary_entries_source_language_check,
  drop constraint if exists vocabulary_entries_target_language_check;

alter table public.vocabulary_entries
  add constraint vocabulary_entries_source_language_check
    check (source_language in ('de', 'pt-BR', 'en')),
  add constraint vocabulary_entries_target_language_check
    check (target_language in ('de', 'pt-BR', 'en'));

alter table public.translation_usage
  drop constraint if exists translation_usage_source_language_check,
  drop constraint if exists translation_usage_target_language_check;

alter table public.translation_usage
  add constraint translation_usage_source_language_check
    check (source_language in ('de', 'pt-BR', 'en')),
  add constraint translation_usage_target_language_check
    check (target_language in ('de', 'pt-BR', 'en'));

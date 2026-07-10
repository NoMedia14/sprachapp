import { supabase } from "../lib/supabase";
import type { LanguageCode, VocabularyEntry } from "../types";

const storageKey = "sprachapp:vocabulary";

type DbEntry = {
  id: string;
  term: string;
  source_language: LanguageCode;
  target_language: LanguageCode;
  translation: string;
  example_source: string;
  example_target: string | null;
  provider: "local" | "public" | "deepl" | "openai";
  created_at: string;
  due_at: string;
  last_reviewed_at: string | null;
  repetitions: number;
  interval_days: number;
  ease_factor: number;
  lapses: number;
  tags: string[];
};

export async function loadVocabulary(): Promise<VocabularyEntry[]> {
  if (supabase) {
    const { data: authData } = await supabase.auth.getUser();

    if (authData.user) {
      const { data, error } = await supabase
        .from("vocabulary_entries")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data) {
        return data.map(fromDbEntry);
      }
    }
  }

  return loadLocalVocabulary();
}

export async function saveVocabularyEntry(entry: VocabularyEntry) {
  if (supabase) {
    const { data: authData } = await supabase.auth.getUser();

    if (authData.user) {
      const { error } = await supabase.from("vocabulary_entries").upsert(toDbEntry(entry, authData.user.id));

      if (!error) {
        return;
      }
    }
  }

  const entries = loadLocalVocabulary();
  const nextEntries = [entry, ...entries.filter((candidate) => candidate.id !== entry.id)];
  saveLocalVocabulary(nextEntries);
}

export async function updateVocabularyEntry(entry: VocabularyEntry) {
  await saveVocabularyEntry(entry);
}

export async function deleteVocabularyEntry(id: string) {
  if (supabase) {
    const { data: authData } = await supabase.auth.getUser();

    if (authData.user) {
      const { error } = await supabase.from("vocabulary_entries").delete().eq("id", id);

      if (!error) {
        return;
      }
    }
  }

  saveLocalVocabulary(loadLocalVocabulary().filter((entry) => entry.id !== id));
}

function loadLocalVocabulary(): VocabularyEntry[] {
  const raw = localStorage.getItem(storageKey);
  return raw ? (JSON.parse(raw) as VocabularyEntry[]) : [];
}

function saveLocalVocabulary(entries: VocabularyEntry[]) {
  localStorage.setItem(storageKey, JSON.stringify(entries));
}

function fromDbEntry(entry: DbEntry): VocabularyEntry {
  return {
    id: entry.id,
    term: entry.term,
    sourceLanguage: entry.source_language,
    targetLanguage: entry.target_language,
    translation: entry.translation,
    exampleSource: entry.example_source,
    exampleTarget: entry.example_target ?? undefined,
    provider: entry.provider,
    createdAt: entry.created_at,
    dueAt: entry.due_at,
    lastReviewedAt: entry.last_reviewed_at ?? undefined,
    repetitions: entry.repetitions,
    intervalDays: entry.interval_days,
    easeFactor: entry.ease_factor,
    lapses: entry.lapses,
    tags: entry.tags,
  };
}

function toDbEntry(entry: VocabularyEntry, userId: string) {
  return {
    id: entry.id,
    user_id: userId,
    term: entry.term,
    source_language: entry.sourceLanguage,
    target_language: entry.targetLanguage,
    translation: entry.translation,
    example_source: entry.exampleSource,
    example_target: entry.exampleTarget ?? null,
    provider: entry.provider,
    created_at: entry.createdAt,
    due_at: entry.dueAt,
    last_reviewed_at: entry.lastReviewedAt ?? null,
    repetitions: entry.repetitions,
    interval_days: entry.intervalDays,
    ease_factor: entry.easeFactor,
    lapses: entry.lapses,
    tags: entry.tags,
  };
}

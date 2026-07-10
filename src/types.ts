export type LanguageCode = "de" | "pt-BR" | "en";

export type StudyLanguageCode = "pt-BR" | "en";

export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | "UNASSIGNED";

export type LearningContentType = "word" | "phrase" | "sentence";

export type ReviewGrade = "again" | "good" | "easy";

export interface TranslationResult {
  term: string;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  translation: string;
  exampleSource: string;
  exampleTarget?: string;
  category: string;
  subcategory: string;
  provider: "local" | "public" | "deepl" | "openai";
  usage?: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
  };
}

export interface VocabularyEntry extends TranslationResult {
  id: string;
  createdAt: string;
  dueAt: string;
  lastReviewedAt?: string;
  repetitions: number;
  intervalDays: number;
  easeFactor: number;
  lapses: number;
  tags: string[];
}

export interface ReviewSettings {
  againDelayMinutes: number;
  reviewIntervalsDays: number[];
  easySkipSteps: number;
}

export interface VocabularyFilters {
  language: LanguageCode | "all";
  category: string;
  subcategory: string;
}

export interface ReferenceLexiconEntry {
  id: string;
  language: StudyLanguageCode;
  lemma: string;
  normalizedLemma: string;
  partOfSpeech: string;
  meaning: string;
  translation?: string;
  cefrLevel: CefrLevel;
  frequencyScore: number;
  dispersionScore: number;
  classificationSource: string;
  confidence: number;
  includeInReferenceLexicon: boolean;
  version: string;
  createdAt: string;
  reviewedAt: string;
  topics: string[];
  contentType: LearningContentType;
  exampleSentence?: string;
}

export interface ReferenceLevelProgress {
  level: Exclude<CefrLevel, "UNASSIGNED">;
  referenceCount: number;
  savedCount: number;
  masteredCount: number;
  missingCount: number;
  unmasteredCount: number;
  percent: number;
}

export interface ProgressSummary {
  language: StudyLanguageCode;
  referenceVersion: string;
  referenceCount: number;
  savedWords: number;
  masteredWords: number;
  savedReferenceLemmas: number;
  masteredReferenceLemmas: number;
  outsideReferenceCount: number;
  unassignedCount: number;
  savedPhrases: number;
  masteredPhrases: number;
  savedSentences: number;
  masteredSentences: number;
  uniqueSavedLemmas: number;
  uniqueMasteredLemmas: number;
  savedMeanings: number;
  masteredMeanings: number;
  overallPercent: number;
  estimatedLevelLabel: string;
  currentLevelLabel: string;
  currentLevelPercent: number;
  levels: ReferenceLevelProgress[];
}

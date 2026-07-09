export type LanguageCode = "de" | "pt-BR";

export type ReviewGrade = "again" | "good" | "easy";

export interface TranslationResult {
  term: string;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  translation: string;
  exampleSource: string;
  exampleTarget?: string;
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

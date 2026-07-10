import { referenceLexicon, referenceVersions } from "../data/referenceLexicon";
import type {
  CefrLevel,
  ProgressSummary,
  ReferenceLexiconEntry,
  ReferenceLevelProgress,
  ReviewSettings,
  StudyLanguageCode,
  TranslationResult,
  VocabularyEntry,
} from "../types";
import { createInitialReviewState, isMasteredByExistingSrs } from "./spacedRepetition";

export const cefrLevels = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export const progressCompletionThreshold = 85;

export const progressLanguages: Array<{ value: StudyLanguageCode; label: string; shortLabel: string }> = [
  { value: "pt-BR", label: "Portugiesisch - Brasilien", shortLabel: "Portugiesisch" },
  { value: "en", label: "Englisch", shortLabel: "Englisch" },
];

export function getReferenceEntries(language: StudyLanguageCode) {
  return referenceLexicon
    .filter((entry) => entry.language === language && entry.includeInReferenceLexicon && entry.cefrLevel !== "UNASSIGNED")
    .sort((a, b) => {
      const levelSort = cefrLevels.indexOf(a.cefrLevel as (typeof cefrLevels)[number]) - cefrLevels.indexOf(b.cefrLevel as (typeof cefrLevels)[number]);

      if (levelSort !== 0) {
        return levelSort;
      }

      return b.frequencyScore - a.frequencyScore;
    });
}

export function calculateProgressSummary(
  entries: VocabularyEntry[],
  language: StudyLanguageCode,
  settings: ReviewSettings,
): ProgressSummary {
  const referenceEntries = getReferenceEntries(language);
  const userEntries = entries.filter((entry) => getEntryStudyLanguage(entry) === language);
  const referenceByLemma = new Map(referenceEntries.map((entry) => [entry.normalizedLemma, entry]));
  const savedReferenceLemmas = new Set<string>();
  const masteredReferenceLemmas = new Set<string>();
  const savedLemmas = new Set<string>();
  const masteredLemmas = new Set<string>();
  let savedPhrases = 0;
  let masteredPhrases = 0;
  let savedSentences = 0;
  let masteredSentences = 0;
  let unassignedCount = 0;

  for (const entry of userEntries) {
    const contentType = getEntryContentType(entry, language);
    const lemma = getEntryNormalizedLemma(entry, language);
    const mastered = isMasteredByExistingSrs(entry, settings);

    if (!lemma) {
      unassignedCount += 1;
      continue;
    }

    if (contentType === "phrase") {
      savedPhrases += 1;
      if (mastered) {
        masteredPhrases += 1;
      }
    } else if (contentType === "sentence") {
      savedSentences += 1;
      if (mastered) {
        masteredSentences += 1;
      }
    } else {
      savedLemmas.add(lemma);
      if (mastered) {
        masteredLemmas.add(lemma);
      }
    }

    const referenceEntry = referenceByLemma.get(lemma);

    if (referenceEntry && contentType === "word") {
      savedReferenceLemmas.add(referenceEntry.normalizedLemma);
      if (mastered) {
        masteredReferenceLemmas.add(referenceEntry.normalizedLemma);
      }
    } else if (contentType === "word") {
      unassignedCount += 1;
    }
  }

  const levels = cefrLevels.map((level) => calculateLevelProgress(referenceEntries, savedReferenceLemmas, masteredReferenceLemmas, level));
  const masteredReferenceTotal = clamp(masteredReferenceLemmas.size, 0, referenceEntries.length);
  const overallPercent = percent(masteredReferenceTotal, referenceEntries.length);
  const levelEstimate = determineEstimatedVocabularyLevel(levels);

  return {
    language,
    referenceVersion: referenceVersions[language],
    referenceCount: referenceEntries.length,
    savedWords: savedLemmas.size,
    masteredWords: masteredLemmas.size,
    savedReferenceLemmas: savedReferenceLemmas.size,
    masteredReferenceLemmas: masteredReferenceTotal,
    outsideReferenceCount: Math.max(savedLemmas.size - savedReferenceLemmas.size, 0),
    unassignedCount,
    savedPhrases,
    masteredPhrases,
    savedSentences,
    masteredSentences,
    uniqueSavedLemmas: savedLemmas.size,
    uniqueMasteredLemmas: masteredLemmas.size,
    savedMeanings: userEntries.length,
    masteredMeanings: userEntries.filter((entry) => isMasteredByExistingSrs(entry, settings)).length,
    overallPercent,
    estimatedLevelLabel: levelEstimate.estimatedLevelLabel,
    currentLevelLabel: levelEstimate.currentLevelLabel,
    currentLevelPercent: levelEstimate.currentLevelPercent,
    levels,
  };
}

export function matchUserEntryWithReference(entry: VocabularyEntry, language: StudyLanguageCode) {
  const lemma = getEntryNormalizedLemma(entry, language);

  if (!lemma) {
    return undefined;
  }

  return getReferenceEntries(language).find((referenceEntry) => referenceEntry.normalizedLemma === lemma);
}

export function getEntryStudyLanguage(entry: VocabularyEntry): StudyLanguageCode | undefined {
  if (entry.sourceLanguage === "pt-BR" || entry.sourceLanguage === "en") {
    return entry.sourceLanguage;
  }

  if (entry.targetLanguage === "pt-BR" || entry.targetLanguage === "en") {
    return entry.targetLanguage;
  }

  return undefined;
}

export function getEntryNormalizedLemma(entry: VocabularyEntry, language: StudyLanguageCode) {
  if (entry.sourceLanguage === language) {
    return normalizeLemma(entry.term, language);
  }

  if (entry.targetLanguage === language) {
    return normalizeLemma(entry.translation, language);
  }

  return "";
}

export function normalizeLemma(value: string, language: StudyLanguageCode) {
  const normalized = value
    .trim()
    .toLocaleLowerCase(language === "pt-BR" ? "pt-BR" : "en")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{Letter}\s'-]/gu, "")
    .replace(/\s+/g, " ");

  return normalized;
}

export function getEntryContentType(entry: VocabularyEntry, language: StudyLanguageCode) {
  const value = entry.sourceLanguage === language ? entry.term : entry.translation;
  const trimmed = value.trim();
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;

  if (/[.!?]$/.test(trimmed) || wordCount >= 5) {
    return "sentence";
  }

  if (wordCount > 1) {
    return "phrase";
  }

  return "word";
}

export function referenceEntryToTranslationResult(entry: ReferenceLexiconEntry): TranslationResult {
  return {
    term: entry.translation || entry.meaning,
    sourceLanguage: "de",
    targetLanguage: entry.language,
    translation: entry.lemma,
    exampleSource: `${entry.translation || entry.lemma} ist ein Referenzwort aus ${entry.cefrLevel}.`,
    exampleTarget: entry.exampleSentence,
    category: entry.partOfSpeech,
    subcategory: entry.topics[0] || "Referenzwortschatz",
    provider: "local",
  };
}

export function createVocabularyFromReference(entry: ReferenceLexiconEntry): VocabularyEntry {
  return {
    ...createInitialReviewState(),
    ...referenceEntryToTranslationResult(entry),
    id: crypto.randomUUID(),
    tags: ["reference", entry.version, entry.cefrLevel],
  };
}

function calculateLevelProgress(
  referenceEntries: ReferenceLexiconEntry[],
  savedReferenceLemmas: Set<string>,
  masteredReferenceLemmas: Set<string>,
  level: (typeof cefrLevels)[number],
): ReferenceLevelProgress {
  const levelEntries = referenceEntries.filter((entry) => entry.cefrLevel === level);
  const levelLemmas = new Set(levelEntries.map((entry) => entry.normalizedLemma));
  const savedCount = countSetIntersection(levelLemmas, savedReferenceLemmas);
  const masteredCount = countSetIntersection(levelLemmas, masteredReferenceLemmas);

  return {
    level,
    referenceCount: levelLemmas.size,
    savedCount,
    masteredCount,
    missingCount: Math.max(levelLemmas.size - savedCount, 0),
    unmasteredCount: Math.max(levelLemmas.size - masteredCount, 0),
    percent: percent(masteredCount, levelLemmas.size),
  };
}

function determineEstimatedVocabularyLevel(levels: ReferenceLevelProgress[]) {
  let completedLevel = "";
  const current = levels.find((levelProgress) => {
    if (levelProgress.percent >= progressCompletionThreshold && levelProgress.referenceCount > 0) {
      completedLevel = levelProgress.level;
      return false;
    }

    return true;
  });

  if (!current) {
    return {
      estimatedLevelLabel: "C2 abgeschlossen",
      currentLevelLabel: "C2 abgeschlossen",
      currentLevelPercent: 100,
    };
  }

  if (!completedLevel && current.level === "A1") {
    return {
      estimatedLevelLabel: "A1 in Bearbeitung",
      currentLevelLabel: "A1 in Bearbeitung",
      currentLevelPercent: current.percent,
    };
  }

  return {
    estimatedLevelLabel: completedLevel ? `${completedLevel} abgeschlossen` : `${current.level} in Bearbeitung`,
    currentLevelLabel: `${current.level} zu ${current.percent} Prozent`,
    currentLevelPercent: current.percent,
  };
}

function countSetIntersection(base: Set<string>, comparison: Set<string>) {
  let count = 0;

  for (const item of base) {
    if (comparison.has(item)) {
      count += 1;
    }
  }

  return count;
}

function percent(value: number, total: number) {
  if (!total) {
    return 0;
  }

  return clamp(Math.round((value / total) * 100), 0, 100);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

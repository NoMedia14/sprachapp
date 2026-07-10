import type { ReviewGrade, ReviewSettings, VocabularyEntry } from "../types";

export const defaultReviewSettings: ReviewSettings = {
  againDelayMinutes: 10,
  reviewIntervalsDays: [1, 3, 7, 14, 21, 60],
  easySkipSteps: 1,
};

const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const addMinutes = (date: Date, minutes: number) => {
  const result = new Date(date);
  result.setMinutes(result.getMinutes() + minutes);
  return result;
};

export function createInitialReviewState() {
  const now = new Date().toISOString();

  return {
    createdAt: now,
    dueAt: now,
    repetitions: 0,
    intervalDays: 0,
    easeFactor: 1,
    lapses: 0,
  };
}

export function isDue(entry: VocabularyEntry, now = new Date()) {
  return new Date(entry.dueAt).getTime() <= now.getTime();
}

export function isMasteredByExistingSrs(entry: VocabularyEntry, settings: ReviewSettings = defaultReviewSettings) {
  const intervals = settings.reviewIntervalsDays.length ? settings.reviewIntervalsDays : defaultReviewSettings.reviewIntervalsDays;
  const masteredInterval = intervals[intervals.length - 1] ?? 60;

  return entry.repetitions >= intervals.length && entry.intervalDays >= masteredInterval;
}

export function applyReviewGrade(
  entry: VocabularyEntry,
  grade: ReviewGrade,
  settings: ReviewSettings,
  reviewedAt = new Date(),
): VocabularyEntry {
  const intervals = settings.reviewIntervalsDays.length ? settings.reviewIntervalsDays : [1, 3, 7, 14, 21, 60];
  let intervalDays = entry.intervalDays;
  let repetitions = entry.repetitions;
  let lapses = entry.lapses;
  let dueAt: Date;

  if (grade === "again") {
    intervalDays = 0;
    lapses += 1;
    dueAt = addMinutes(reviewedAt, settings.againDelayMinutes);
  } else if (grade === "easy") {
    const stepIndex = Math.min(repetitions + settings.easySkipSteps, intervals.length - 1);
    intervalDays = intervals[stepIndex];
    repetitions += 1;
    dueAt = addDays(reviewedAt, intervalDays);
  } else {
    const stepIndex = Math.min(repetitions, intervals.length - 1);
    intervalDays = intervals[stepIndex];
    repetitions += 1;
    dueAt = addDays(reviewedAt, intervalDays);
  }

  return {
    ...entry,
    dueAt: dueAt.toISOString(),
    lastReviewedAt: reviewedAt.toISOString(),
    repetitions,
    intervalDays,
    easeFactor: 1,
    lapses,
  };
}

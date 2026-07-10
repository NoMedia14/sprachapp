import { describe, expect, it } from "vitest";
import { getReferenceEntries } from "./progressService";
import { calculateProgressSummary } from "./progressService";
import { defaultReviewSettings } from "./spacedRepetition";
import type { LanguageCode, VocabularyEntry } from "../types";

describe("progressService", () => {
  it("keeps progress separated by language", () => {
    const entries = [
      entry("Haus", "casa", "pt-BR", true),
      entry("Haus", "house", "en", true),
    ];

    const portuguese = calculateProgressSummary(entries, "pt-BR", defaultReviewSettings);
    const english = calculateProgressSummary(entries, "en", defaultReviewSettings);

    expect(portuguese.masteredReferenceLemmas).toBe(1);
    expect(english.masteredReferenceLemmas).toBe(1);
    expect(portuguese.referenceVersion).toBe("pt-BR-reference-v1");
    expect(english.referenceVersion).toBe("en-reference-v1");
  });

  it("does not let a higher level count as reached while lower levels are incomplete", () => {
    const entries = [
      entry("Reise", "viagem", "pt-BR", true),
      entry("Arbeit", "trabalho", "pt-BR", true),
      entry("kaufen", "comprar", "pt-BR", true),
    ];

    const summary = calculateProgressSummary(entries, "pt-BR", defaultReviewSettings);

    expect(summary.levels.find((level) => level.level === "A2")?.percent).toBe(100);
    expect(summary.estimatedLevelLabel).toBe("A1 in Bearbeitung");
  });

  it("calculates target counts from the reference entries", () => {
    const summary = calculateProgressSummary([], "en", defaultReviewSettings);
    const referenceEntries = getReferenceEntries("en");

    expect(summary.referenceCount).toBe(referenceEntries.length);
    expect(summary.levels.find((level) => level.level === "A1")?.referenceCount).toBe(
      referenceEntries.filter((entry) => entry.cefrLevel === "A1").length,
    );
  });

  it("does not count duplicate learned lemmas above one hundred percent", () => {
    const entries = [
      entry("Haus", "house", "en", true),
      entry("das Haus", "house", "en", true),
      entry("Haus", "house", "en", true),
    ];

    const summary = calculateProgressSummary(entries, "en", defaultReviewSettings);

    expect(summary.levels.find((level) => level.level === "A1")?.percent).toBeLessThanOrEqual(100);
    expect(summary.masteredReferenceLemmas).toBe(1);
  });
});

function entry(term: string, translation: string, targetLanguage: Extract<LanguageCode, "pt-BR" | "en">, mastered: boolean): VocabularyEntry {
  return {
    id: crypto.randomUUID(),
    term,
    sourceLanguage: "de",
    targetLanguage,
    translation,
    exampleSource: `${term} ist ein Beispiel.`,
    exampleTarget: `${translation} example.`,
    category: "Nomen",
    subcategory: "Test",
    provider: "local",
    createdAt: "2026-07-10T00:00:00.000Z",
    dueAt: "2026-07-10T00:00:00.000Z",
    lastReviewedAt: mastered ? "2026-07-10T00:00:00.000Z" : undefined,
    repetitions: mastered ? defaultReviewSettings.reviewIntervalsDays.length : 0,
    intervalDays: mastered ? defaultReviewSettings.reviewIntervalsDays[defaultReviewSettings.reviewIntervalsDays.length - 1] ?? 60 : 0,
    easeFactor: 1,
    lapses: 0,
    tags: [],
  };
}

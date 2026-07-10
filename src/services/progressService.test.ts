import { describe, expect, it } from "vitest";
import { calculateProgressSummary, getEntryContentType, getReferenceEntries, normalizeLemma } from "./progressService";
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
    expect(portuguese.referenceVersion).toBe("pt-BR-cefr-mapped-reference-v3");
    expect(english.referenceVersion).toBe("en-cefr-reference-v3");
  });

  it("does not let a higher level count as reached while lower levels are incomplete", () => {
    const entries = getReferenceEntries("pt-BR")
      .filter((referenceEntry) => referenceEntry.cefrLevel === "A2")
      .map((referenceEntry) => entry(referenceEntry.translation ?? referenceEntry.meaning, referenceEntry.lemma, "pt-BR", true));

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

  it("ships a substantial unique reference vocabulary for both languages", () => {
    for (const language of ["pt-BR", "en"] as const) {
      const referenceEntries = getReferenceEntries(language);
      const uniqueLemmas = new Set(referenceEntries.map((referenceEntry) => referenceEntry.normalizedLemma));
      const levelCounts = Object.fromEntries(
        ["A1", "A2", "B1", "B2", "C1", "C2"].map((level) => [
          level,
          referenceEntries.filter((referenceEntry) => referenceEntry.cefrLevel === level).length,
        ]),
      );

      expect(referenceEntries).toHaveLength(3000);
      expect(uniqueLemmas.size).toBe(referenceEntries.length);
      expect(levelCounts).toEqual(
        language === "pt-BR"
          ? { A1: 620, A2: 620, B1: 660, B2: 550, C1: 400, C2: 150 }
          : { A1: 500, A2: 600, B1: 700, B2: 600, C1: 400, C2: 200 },
      );
    }
  });

  it("keeps Portuguese accents distinct and recognizes English infinitives as one lemma", () => {
    expect(normalizeLemma("e", "pt-BR")).not.toBe(normalizeLemma("é", "pt-BR"));
    expect(normalizeLemma("to work", "en")).toBe("work");
    expect(getEntryContentType(entry("arbeiten", "to work", "en", false), "en")).toBe("word");
  });

  it("keeps central Brazilian Portuguese vocabulary in practical beginner levels", () => {
    const byLemma = new Map(getReferenceEntries("pt-BR").map((referenceEntry) => [referenceEntry.normalizedLemma, referenceEntry.cefrLevel]));

    for (const lemma of ["ser", "vida", "homem", "comer", "casa", "porta", "água", "família"]) {
      expect(byLemma.get(lemma)).toBe("A1");
    }

    for (const lemma of ["morango", "garfo", "cenoura", "trabalho", "viagem", "aeroporto", "hospital"]) {
      expect(byLemma.get(lemma)).toBe("A2");
    }
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

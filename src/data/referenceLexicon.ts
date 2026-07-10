import generatedReferenceData from "./referenceLexicon.generated.json";
import type { CefrLevel, ReferenceLexiconEntry, StudyLanguageCode } from "../types";

type ReferenceTuple = [
  lemma: string,
  translation: string,
  partOfSpeech: string,
  cefrLevel: Exclude<CefrLevel, "UNASSIGNED">,
  topic: string,
  frequencyScore: number,
  translationSource: "curated" | "dictionary",
];

interface GeneratedReferenceData {
  generatedAt: string;
  versions: Record<StudyLanguageCode, string>;
  languages: Record<StudyLanguageCode, ReferenceTuple[]>;
}

const generated = generatedReferenceData as unknown as GeneratedReferenceData;

export const referenceVersions = generated.versions;

export const referenceLexicon: ReferenceLexiconEntry[] = (["pt-BR", "en"] as const).flatMap((language) =>
  generated.languages[language].map((item, index) => createReferenceEntry(language, item, index)),
);

function createReferenceEntry(
  language: StudyLanguageCode,
  [lemma, translation, partOfSpeech, cefrLevel, topic, frequencyScore, translationSource]: ReferenceTuple,
  index: number,
): ReferenceLexiconEntry {
  return {
    id: `${language}-${cefrLevel}-${index + 1}-${normalizeReferenceLemma(lemma)}`,
    language,
    lemma,
    normalizedLemma: normalizeReferenceLemma(lemma),
    partOfSpeech,
    meaning:
      translationSource === "curated"
        ? "Manuell geprüfte deutsche Entsprechung"
        : "Offener Wörterbuchvorschlag; beim Hinzufügen prüft die KI erneut",
    translation,
    translationSource,
    cefrLevel,
    frequencyScore,
    dispersionScore: Math.min(0.95, Math.max(0.5, 0.5 + frequencyScore * 0.45)),
    classificationSource:
      language === "en"
        ? "Words-CEFR-Dataset + FreeDict"
        : "Words-CEFR-Dataset mapping + FrequencyWords pt-BR + FreeDict",
    confidence: language === "en" ? 0.85 : 0.78,
    includeInReferenceLexicon: true,
    version: generated.versions[language],
    createdAt: generated.generatedAt,
    reviewedAt: generated.generatedAt,
    topics: [topic],
    contentType: "word",
  };
}

function normalizeReferenceLemma(value: string) {
  return value
    .trim()
    .toLocaleLowerCase()
    .normalize("NFC")
    .replace(/[^\p{Letter}'-]/gu, "");
}

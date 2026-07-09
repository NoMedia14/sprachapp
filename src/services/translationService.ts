import { supabase } from "../lib/supabase";
import type { LanguageCode, TranslationResult } from "../types";

export type LanguageSelection = LanguageCode | "auto";

const localDictionary: Record<string, Partial<Record<LanguageCode, string>>> = {
  haus: { "pt-BR": "casa" },
  wasser: { "pt-BR": "agua" },
  arbeiten: { "pt-BR": "trabalhar" },
  saudade: { de: "Sehnsucht" },
  obrigado: { de: "danke" },
  casa: { de: "Haus" },
  aprender: { de: "lernen" },
};

const exampleTemplates: Record<LanguageCode, (term: string) => string> = {
  de: (term) => `Ich benutze das Wort ${term} heute in einem einfachen Satz.`,
  "pt-BR": (term) => `Eu uso a palavra ${term} hoje em uma frase simples.`,
};

export function getTargetLanguage(sourceLanguage: LanguageCode): LanguageCode {
  return sourceLanguage === "de" ? "pt-BR" : "de";
}

export async function translateWord(term: string, selectedLanguage: LanguageSelection): Promise<TranslationResult> {
  const sourceLanguage = resolveSourceLanguage(term, selectedLanguage);
  const targetLanguage = getTargetLanguage(sourceLanguage);

  if (supabase) {
    const { data, error } = await supabase.functions.invoke<TranslationResult>("translate-word", {
      body: { term, sourceLanguage, targetLanguage },
    });

    if (!error && data?.translation) {
      return data;
    }
  }

  try {
    return await createPublicTranslationResult(term, sourceLanguage, targetLanguage);
  } catch {
    return createLocalResult(term, sourceLanguage, targetLanguage);
  }
}

function resolveSourceLanguage(term: string, selectedLanguage: LanguageSelection): LanguageCode {
  if (selectedLanguage !== "auto") {
    return selectedLanguage;
  }

  const normalized = term.trim().toLowerCase();
  const dictionaryHit = localDictionary[normalized];

  if (dictionaryHit?.de && !dictionaryHit["pt-BR"]) {
    return "pt-BR";
  }

  if (dictionaryHit?.["pt-BR"] && !dictionaryHit.de) {
    return "de";
  }

  return /[\u00e0-\u00ff]|\b(o|a|os|as|um|uma|eu|voce|obrigad[oa])\b/i.test(term) ? "pt-BR" : "de";
}

async function createPublicTranslationResult(
  term: string,
  sourceLanguage: LanguageCode,
  targetLanguage: LanguageCode,
): Promise<TranslationResult> {
  const exampleSource = exampleTemplates[sourceLanguage](term);
  const [translation, exampleTarget] = await Promise.all([
    translateWithPublicApi(term, sourceLanguage, targetLanguage),
    translateWithPublicApi(exampleSource, sourceLanguage, targetLanguage),
  ]);

  return {
    term,
    sourceLanguage,
    targetLanguage,
    translation,
    exampleSource,
    exampleTarget,
    provider: "public",
  };
}

async function translateWithPublicApi(text: string, sourceLanguage: LanguageCode, targetLanguage: LanguageCode) {
  const params = new URLSearchParams({
    q: text,
    langpair: `${sourceLanguage}|${targetLanguage}`,
  });

  const response = await fetch(`https://api.mymemory.translated.net/get?${params.toString()}`);

  if (!response.ok) {
    throw new Error("Public translation request failed");
  }

  const data = (await response.json()) as { responseData?: { translatedText?: string } };
  const translatedText = data.responseData?.translatedText?.trim();

  if (!translatedText) {
    throw new Error("Public translation response was empty");
  }

  return translatedText;
}

function createLocalResult(
  term: string,
  sourceLanguage: LanguageCode,
  targetLanguage: LanguageCode,
): TranslationResult {
  const normalized = term.trim().toLowerCase();
  const translation = localDictionary[normalized]?.[targetLanguage] ?? term;

  return {
    term,
    sourceLanguage,
    targetLanguage,
    translation,
    exampleSource: exampleTemplates[sourceLanguage](term),
    exampleTarget: exampleTemplates[targetLanguage](translation),
    provider: "local",
  };
}

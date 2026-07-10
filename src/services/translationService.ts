import { supabase } from "../lib/supabase";
import type { LanguageCode, TranslationResult } from "../types";

const localDictionary: Record<string, Partial<Record<LanguageCode, string>>> = {
  haus: { "pt-BR": "casa" },
  tür: { "pt-BR": "porta", en: "door" },
  tuer: { "pt-BR": "porta", en: "door" },
  wasser: { "pt-BR": "agua", en: "water" },
  arbeiten: { "pt-BR": "trabalhar", en: "to work" },
  saudade: { de: "Sehnsucht" },
  obrigado: { de: "danke" },
  casa: { de: "Haus" },
  aprender: { de: "lernen" },
  door: { de: "Tür", "pt-BR": "porta" },
  water: { de: "Wasser", "pt-BR": "agua" },
};

const exampleTemplates: Record<LanguageCode, (term: string) => string> = {
  de: (term) => `Ich benutze das Wort ${term} heute in einem einfachen Satz.`,
  "pt-BR": (term) => `Eu uso a palavra ${term} hoje em uma frase simples.`,
  en: (term) => `I use the word ${term} in a simple sentence today.`,
};

export async function translateWord(
  term: string,
  sourceLanguage: LanguageCode,
  targetLanguage: LanguageCode,
): Promise<TranslationResult> {
  if (sourceLanguage === targetLanguage) {
    throw new Error("Source and target language must be different");
  }

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
    category: categorizeLocal(term, translation),
    subcategory: subcategorizeLocal(term, translation),
    provider: "public",
  };
}

async function translateWithPublicApi(text: string, sourceLanguage: LanguageCode, targetLanguage: LanguageCode) {
  const params = new URLSearchParams({
    q: text,
    langpair: `${toPublicApiLanguage(sourceLanguage)}|${toPublicApiLanguage(targetLanguage)}`,
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

function toPublicApiLanguage(language: LanguageCode) {
  return language === "pt-BR" ? "pt" : language;
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
    category: categorizeLocal(term, translation),
    subcategory: subcategorizeLocal(term, translation),
    provider: "local",
  };
}

function categorizeLocal(term: string, translation: string) {
  const text = `${term} ${translation}`.toLowerCase();

  if (/\b(arbeiten|trabalhar|work|lernen|aprender|learn)\b/.test(text)) {
    return "Verben";
  }

  if (/\b(schnell|langsam|gut|bad|bom|boa|ruim)\b/.test(text)) {
    return "Adjektive";
  }

  return "Nomen";
}

function subcategorizeLocal(term: string, translation: string) {
  const text = `${term} ${translation}`.toLowerCase();

  if (/\b(apfel|apple|maca|maçã|banana|orange)\b/.test(text)) {
    return "Obst";
  }

  if (/\b(tuer|tür|door|porta|fenster|window|janela|wand|wall|parede|boden|floor|chao|chão)\b/.test(text)) {
    return "Haus";
  }

  if (/\b(tisch|table|mesa|stuhl|chair|cadeira|lampe|lamp|lampada|lâmpada|decke|blanket|cobertor)\b/.test(text)) {
    return "Möbel";
  }

  return "Allgemein";
}

/// <reference types="jsr:@supabase/functions-js/edge-runtime.d.ts" />

type LanguageCode = "de" | "pt-BR" | "en";

interface RequestBody {
  term: string;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
}

interface UsagePayload {
  provider: "openai";
  model: string;
  term: string;
  source_language: LanguageCode;
  target_language: LanguageCode;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_usd: number;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const textModelPricesUsdPerMillion: Record<string, { input: number; output: number }> = {
  "gpt-5.4-mini": { input: 0.75, output: 4.5 },
  "gpt-5.4-nano": { input: 0.2, output: 1.25 },
  "gpt-5-nano": { input: 0.05, output: 0.4 },
  "gpt-4.1-nano": { input: 0.1, output: 0.4 },
};

const examples: Record<LanguageCode, (term: string) => string> = {
  de: (term) => `Ich benutze das Wort ${term} heute in einem einfachen Satz.`,
  "pt-BR": (term) => `Eu uso a palavra ${term} hoje em uma frase simples.`,
  en: (term) => `I use the word ${term} in a simple sentence today.`,
};

const languageNames: Record<LanguageCode, string> = {
  de: "German",
  "pt-BR": "Brazilian Portuguese",
  en: "English",
};

const supportedLanguages = new Set(["de", "pt-BR", "en"]);

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await request.json()) as RequestBody;
    const term = body.term?.trim();

    if (!term || !body.sourceLanguage || !body.targetLanguage) {
      return json({ error: "term, sourceLanguage and targetLanguage are required" }, 400);
    }

    if (
      !supportedLanguages.has(body.sourceLanguage) ||
      !supportedLanguages.has(body.targetLanguage) ||
      body.sourceLanguage === body.targetLanguage
    ) {
      return json({ error: "sourceLanguage and targetLanguage must be different supported languages" }, 400);
    }

    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    if (openAiKey) {
      return json(await translateWithOpenAi(request, term, body.sourceLanguage, body.targetLanguage, openAiKey));
    }

    const deeplKey = Deno.env.get("DEEPL_API_KEY");
    if (deeplKey) {
      return json(await translateWithDeepL(term, body.sourceLanguage, body.targetLanguage, deeplKey));
    }

    return json({
      term,
      sourceLanguage: body.sourceLanguage,
      targetLanguage: body.targetLanguage,
      translation: `[${body.targetLanguage}] ${term}`,
      exampleSource: examples[body.sourceLanguage](term),
      exampleTarget: examples[body.targetLanguage](`[${body.targetLanguage}] ${term}`),
      category: "Nomen",
      subcategory: "Allgemein",
      provider: "local",
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

async function translateWithOpenAi(
  request: Request,
  term: string,
  sourceLanguage: LanguageCode,
  targetLanguage: LanguageCode,
  apiKey: string,
) {
  const model = Deno.env.get("OPENAI_MODEL") ?? "gpt-5.4-mini";
  const prompt = [
    "You are a precise vocabulary tutor for German, Brazilian Portuguese, and English.",
    "Return only valid JSON. Do not use markdown.",
    "Translate exactly one vocabulary item from the source language into the target language.",
    "Never return the original source word as the translation unless it is truly identical in the target language.",
    "Prefer the most common everyday meaning. If there are several important meanings, use the best single translation for a vocabulary app.",
    "Write one natural example sentence in the source language that contains the original term exactly once.",
    "Write a natural translation of that example sentence in the target language.",
    "Classify the vocabulary item into a broad German learning category like Nomen, Verben, Adjektive, Adverbien, Präpositionen, Ausdrücke, Zahlen, Sonstiges.",
    "Also add a useful German subcategory like Obst, Gemüse, Haushalt, Möbel, Essen, Arbeit, Reise, Körper, Familie, Zeit, Farben, Gefühle, Allgemein.",
    "Use concise German category labels. Do not invent overly specific subcategories for a single word.",
    "For example, German 'Tür' translated to Brazilian Portuguese is 'porta' and to English is 'door'.",
    `Term: ${term}`,
    `Source language: ${languageNames[sourceLanguage]} (${sourceLanguage})`,
    `Target language: ${languageNames[targetLanguage]} (${targetLanguage})`,
    'Schema: {"translation":"...","exampleSource":"...","exampleTarget":"...","category":"Nomen","subcategory":"Haushalt"}',
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: prompt,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${errorText.slice(0, 220)}`);
  }

  const data = await response.json();
  const text = data.output_text ?? extractOutputText(data);
  const parsed = parseJsonObject(text);
  const inputTokens = Number(data.usage?.input_tokens ?? data.usage?.prompt_tokens ?? 0);
  const outputTokens = Number(data.usage?.output_tokens ?? data.usage?.completion_tokens ?? 0);
  const totalTokens = Number(data.usage?.total_tokens ?? inputTokens + outputTokens);
  const estimatedCostUsd = estimateTextCostUsd(model, inputTokens, outputTokens);

  await recordTranslationUsage(request, {
    provider: "openai",
    model,
    term,
    source_language: sourceLanguage,
    target_language: targetLanguage,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: totalTokens,
    cost_usd: estimatedCostUsd,
  });

  return {
    term,
    sourceLanguage,
    targetLanguage,
    translation: String(parsed.translation),
    exampleSource: String(parsed.exampleSource),
    exampleTarget: parsed.exampleTarget ? String(parsed.exampleTarget) : undefined,
    category: normalizeLabel(parsed.category, "Nomen"),
    subcategory: normalizeLabel(parsed.subcategory, "Allgemein"),
    provider: "openai",
    usage: {
      model,
      inputTokens,
      outputTokens,
      totalTokens,
      estimatedCostUsd,
    },
  };
}

async function translateWithDeepL(
  term: string,
  sourceLanguage: LanguageCode,
  targetLanguage: LanguageCode,
  apiKey: string,
) {
  const apiUrl = Deno.env.get("DEEPL_API_URL") ?? "https://api-free.deepl.com/v2/translate";
  const params = new URLSearchParams({
    text: term,
    source_lang: toDeepLLanguage(sourceLanguage),
    target_lang: toDeepLLanguage(targetLanguage),
  });

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  if (!response.ok) {
    throw new Error(`DeepL request failed: ${response.status}`);
  }

  const data = await response.json();
  const translation = data.translations?.[0]?.text ?? `[${targetLanguage}] ${term}`;

  return {
    term,
    sourceLanguage,
    targetLanguage,
    translation,
    exampleSource: examples[sourceLanguage](term),
    exampleTarget: examples[targetLanguage](translation),
    category: "Nomen",
    subcategory: "Allgemein",
    provider: "deepl",
  };
}

function toDeepLLanguage(language: LanguageCode) {
  if (language === "de") {
    return "DE";
  }

  if (language === "en") {
    return "EN";
  }

  return "PT-BR";
}

function extractOutputText(data: unknown): string {
  const output = (data as { output?: Array<{ content?: Array<{ text?: string }> }> }).output;
  return output?.flatMap((item) => item.content ?? []).map((item) => item.text ?? "").join("") ?? "";
}

function parseJsonObject(text: string) {
  const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "");
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error("OpenAI response did not contain JSON");
  }

  return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
}

function normalizeLabel(value: unknown, fallback: string) {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, 40) : fallback;
}

function estimateTextCostUsd(model: string, inputTokens: number, outputTokens: number) {
  const prices = textModelPricesUsdPerMillion[model] ?? textModelPricesUsdPerMillion["gpt-5.4-mini"];

  return (inputTokens / 1_000_000) * prices.input + (outputTokens / 1_000_000) * prices.output;
}

async function recordTranslationUsage(request: Request, payload: UsagePayload) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const authorization = request.headers.get("Authorization");

  if (!supabaseUrl || !supabaseAnonKey || !authorization) {
    return;
  }

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/translation_usage`, {
      method: "POST",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: authorization,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.warn(`Usage logging failed: ${response.status}`);
    }
  } catch (error) {
    console.warn("Usage logging failed", error);
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

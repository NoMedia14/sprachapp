/// <reference types="jsr:@supabase/functions-js/edge-runtime.d.ts" />

type LanguageCode = "de" | "pt-BR";

interface RequestBody {
  term: string;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const examples: Record<LanguageCode, (term: string) => string> = {
  de: (term) => `Ich benutze das Wort ${term} heute in einem einfachen Satz.`,
  "pt-BR": (term) => `Eu uso a palavra ${term} hoje em uma frase simples.`,
};

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

    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    if (openAiKey) {
      return json(await translateWithOpenAi(term, body.sourceLanguage, body.targetLanguage, openAiKey));
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
      provider: "local",
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

async function translateWithOpenAi(
  term: string,
  sourceLanguage: LanguageCode,
  targetLanguage: LanguageCode,
  apiKey: string,
) {
  const model = Deno.env.get("OPENAI_MODEL") ?? "gpt-5.4-mini";
  const prompt = [
    "You are a precise German and Brazilian Portuguese vocabulary tutor.",
    "Return only valid JSON. Do not use markdown.",
    "Translate one vocabulary item between German and Brazilian Portuguese.",
    "Prefer the most common everyday meaning. If there are several important meanings, use the best single translation for a vocabulary app.",
    "Write one natural example sentence in the source language that contains the original term exactly once.",
    "Write a natural translation of that example sentence in the target language.",
    `Term: ${term}`,
    `Source language: ${sourceLanguage}`,
    `Target language: ${targetLanguage}`,
    'Schema: {"translation":"...","exampleSource":"...","exampleTarget":"..."}',
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

  return {
    term,
    sourceLanguage,
    targetLanguage,
    translation: String(parsed.translation),
    exampleSource: String(parsed.exampleSource),
    exampleTarget: parsed.exampleTarget ? String(parsed.exampleTarget) : undefined,
    provider: "openai",
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
    source_lang: sourceLanguage === "de" ? "DE" : "PT",
    target_lang: targetLanguage === "de" ? "DE" : "PT-BR",
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
    provider: "deepl",
  };
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

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

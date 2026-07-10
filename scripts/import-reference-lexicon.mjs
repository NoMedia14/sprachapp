import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const allowedLanguages = new Set(["pt-BR", "en"]);
const allowedLevels = new Set(["A1", "A2", "B1", "B2", "C1", "C2", "UNASSIGNED"]);
const allowedContentTypes = new Set(["word", "phrase", "sentence"]);
const confidenceThreshold = 0.75;

const [, , inputFile, outputFile = "supabase/seed/reference-lexicon-upsert.sql"] = process.argv;

if (!inputFile) {
  console.error("Usage: npm run reference:import -- path/to/reference-lexicon.json [output.sql]");
  process.exit(1);
}

const inputPath = resolve(inputFile);
const outputPath = resolve(outputFile);
const raw = await readFile(inputPath, "utf8");
const entries = JSON.parse(raw);

if (!Array.isArray(entries)) {
  throw new Error("Reference lexicon import file must contain a JSON array.");
}

const seen = new Set();
const validEntries = [];
const rejectedEntries = [];

for (const [index, entry] of entries.entries()) {
  const problems = validateEntry(entry);
  const duplicateKey = `${entry.language}:${entry.version}:${entry.normalizedLemma}:${entry.partOfSpeech}:${entry.meaning}`;

  if (seen.has(duplicateKey)) {
    problems.push("duplicate normalized lemma/partOfSpeech/meaning in same language and version");
  }

  if (!problems.length) {
    seen.add(duplicateKey);
    validEntries.push(entry);
  } else {
    rejectedEntries.push({ index, lemma: entry?.lemma, problems });
  }
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, buildSql(validEntries), "utf8");

console.log(`Validated ${entries.length} entries.`);
console.log(`Accepted: ${validEntries.length}`);
console.log(`Rejected: ${rejectedEntries.length}`);

if (rejectedEntries.length) {
  console.log(JSON.stringify(rejectedEntries.slice(0, 20), null, 2));
}

function validateEntry(entry) {
  const problems = [];

  if (!entry || typeof entry !== "object") {
    return ["entry is not an object"];
  }

  for (const field of ["id", "language", "lemma", "normalizedLemma", "partOfSpeech", "meaning", "cefrLevel", "version"]) {
    if (!entry[field] || typeof entry[field] !== "string") {
      problems.push(`${field} is required`);
    }
  }

  if (!allowedLanguages.has(entry.language)) {
    problems.push("language must be pt-BR or en");
  }

  if (!allowedLevels.has(entry.cefrLevel)) {
    problems.push("cefrLevel is invalid");
  }

  if (!allowedContentTypes.has(entry.contentType || "word")) {
    problems.push("contentType is invalid");
  }

  for (const scoreField of ["frequencyScore", "dispersionScore", "confidence"]) {
    if (typeof entry[scoreField] !== "number" || entry[scoreField] < 0 || entry[scoreField] > 1) {
      problems.push(`${scoreField} must be a number between 0 and 1`);
    }
  }

  if (entry.confidence < confidenceThreshold && entry.cefrLevel !== "UNASSIGNED") {
    problems.push(`confidence below ${confidenceThreshold} must use UNASSIGNED`);
  }

  if (!Array.isArray(entry.topics)) {
    problems.push("topics must be an array");
  }

  return problems;
}

function buildSql(entries) {
  const values = entries.map((entry) => {
    return `(${[
      sql(entry.id),
      sql(entry.language),
      sql(entry.lemma),
      sql(entry.normalizedLemma),
      sql(entry.partOfSpeech),
      sql(entry.meaning),
      sql(entry.translation ?? null),
      sql(entry.cefrLevel),
      number(entry.frequencyScore),
      number(entry.dispersionScore),
      sql(entry.classificationSource ?? "external-import"),
      number(entry.confidence),
      entry.includeInReferenceLexicon === false ? "false" : "true",
      sql(entry.version),
      array(entry.topics ?? []),
      sql(entry.contentType ?? "word"),
      sql(entry.exampleSentence ?? null),
      sql(entry.createdAt ?? new Date().toISOString()),
      sql(entry.reviewedAt ?? new Date().toISOString()),
    ].join(", ")})`;
  });

  if (!values.length) {
    return "-- No valid reference entries to import.\n";
  }

  return `insert into public.reference_lexicon_entries (
  id,
  language,
  lemma,
  normalized_lemma,
  part_of_speech,
  meaning,
  translation,
  cefr_level,
  frequency_score,
  dispersion_score,
  classification_source,
  confidence,
  include_in_reference_lexicon,
  version,
  topics,
  content_type,
  example_sentence,
  created_at,
  reviewed_at
) values
${values.join(",\n")}
on conflict (language, version, normalized_lemma, part_of_speech, meaning) do update set
  lemma = excluded.lemma,
  translation = excluded.translation,
  cefr_level = excluded.cefr_level,
  frequency_score = excluded.frequency_score,
  dispersion_score = excluded.dispersion_score,
  classification_source = excluded.classification_source,
  confidence = excluded.confidence,
  include_in_reference_lexicon = excluded.include_in_reference_lexicon,
  topics = excluded.topics,
  content_type = excluded.content_type,
  example_sentence = excluded.example_sentence,
  reviewed_at = excluded.reviewed_at;
`;
}

function sql(value) {
  if (value === null || value === undefined) {
    return "null";
  }

  return `'${String(value).replaceAll("'", "''")}'`;
}

function number(value) {
  return Number(value).toFixed(3);
}

function array(values) {
  return `array[${values.map(sql).join(", ")}]::text[]`;
}

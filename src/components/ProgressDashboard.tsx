import { BookPlus, CheckCircle2, ChevronDown, ChevronUp, Loader2, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import {
  calculateProgressSummary,
  getEntryNormalizedLemma,
  getEntryStudyLanguage,
  getReferenceEntries,
  progressCompletionThreshold,
  progressLanguages,
  referenceEntryToTranslationResult,
} from "../services/progressService";
import { isMasteredByExistingSrs } from "../services/spacedRepetition";
import type { CefrLevel, ReferenceLexiconEntry, ReviewSettings, StudyLanguageCode, TranslationResult, VocabularyEntry } from "../types";

interface ProgressDashboardProps {
  entries: VocabularyEntry[];
  settings: ReviewSettings;
  onSave: (result: TranslationResult) => Promise<void>;
}

type ReferenceStatusFilter = "all" | "saved" | "missing" | "mastered" | "learning";
type ReferenceSort = "frequency" | "alphabetical" | "status";

const storageKey = "sprachapp:progress-language";

const statusLabels: Record<ReferenceStatusFilter, string> = {
  all: "Alle",
  saved: "Gespeichert",
  missing: "Nicht gespeichert",
  mastered: "Beherrscht",
  learning: "Noch zu lernen",
};

export function ProgressDashboard({ entries, settings, onSave }: ProgressDashboardProps) {
  const [language, setLanguage] = useState<StudyLanguageCode>(() => {
    const stored = localStorage.getItem(storageKey);
    return stored === "en" || stored === "pt-BR" ? stored : "pt-BR";
  });
  const [selectedLevel, setSelectedLevel] = useState<Exclude<CefrLevel, "UNASSIGNED"> | null>("A1");
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("all");
  const [partOfSpeech, setPartOfSpeech] = useState("all");
  const [statusFilter, setStatusFilter] = useState<ReferenceStatusFilter>("all");
  const [sort, setSort] = useState<ReferenceSort>("frequency");
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  const summary = useMemo(() => calculateProgressSummary(entries, language, settings), [entries, language, settings]);
  const referenceEntries = useMemo(() => getReferenceEntries(language), [language]);
  const userLemmas = useMemo(() => getUserLemmaMap(entries, language, settings), [entries, language, settings]);
  const topics = useMemo(() => uniqueValues(referenceEntries.flatMap((entry) => entry.topics)), [referenceEntries]);
  const partsOfSpeech = useMemo(() => uniqueValues(referenceEntries.map((entry) => entry.partOfSpeech)), [referenceEntries]);

  const filteredReferenceEntries = useMemo(() => {
    const levelEntries = referenceEntries.filter((entry) => !selectedLevel || entry.cefrLevel === selectedLevel);
    const normalizedQuery = query.trim().toLocaleLowerCase("de");

    return levelEntries
      .filter((entry) => {
        const status = getReferenceStatus(entry, userLemmas);
        const matchesQuery =
          !normalizedQuery ||
          [entry.lemma, entry.translation, entry.meaning, entry.partOfSpeech].some((value) =>
            (value ?? "").toLocaleLowerCase("de").includes(normalizedQuery),
          );
        const matchesTopic = topic === "all" || entry.topics.includes(topic);
        const matchesPartOfSpeech = partOfSpeech === "all" || entry.partOfSpeech === partOfSpeech;
        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "saved" && status !== "missing") ||
          (statusFilter === "missing" && status === "missing") ||
          (statusFilter === "mastered" && status === "mastered") ||
          (statusFilter === "learning" && status !== "mastered");

        return matchesQuery && matchesTopic && matchesPartOfSpeech && matchesStatus;
      })
      .sort((a, b) => sortReferenceEntries(a, b, sort, userLemmas));
  }, [partOfSpeech, query, referenceEntries, selectedLevel, sort, statusFilter, topic, userLemmas]);

  const selectedLanguageLabel = progressLanguages.find((option) => option.value === language)?.label ?? language;

  const changeLanguage = (nextLanguage: StudyLanguageCode) => {
    setLanguage(nextLanguage);
    localStorage.setItem(storageKey, nextLanguage);
    setSelectedLevel("A1");
    setTopic("all");
    setPartOfSpeech("all");
    setStatusFilter("all");
    setQuery("");
  };

  const addReferenceEntry = async (entry: ReferenceLexiconEntry) => {
    if (userLemmas.has(entry.normalizedLemma) || savingIds.has(entry.id)) {
      return;
    }

    setSavingIds((current) => new Set(current).add(entry.id));
    await onSave(referenceEntryToTranslationResult(entry));
    setSavingIds((current) => {
      const next = new Set(current);
      next.delete(entry.id);
      return next;
    });
  };

  const addMissingLevelEntries = async (level: Exclude<CefrLevel, "UNASSIGNED">) => {
    const missingEntries = referenceEntries.filter((entry) => entry.cefrLevel === level && !userLemmas.has(entry.normalizedLemma));

    if (!missingEntries.length) {
      return;
    }

    const confirmed = window.confirm(`${missingEntries.length} fehlende Wörter aus ${level} zum Lernen hinzufügen?`);

    if (!confirmed) {
      return;
    }

    setSavingIds((current) => new Set([...current, ...missingEntries.map((entry) => entry.id)]));

    for (const entry of missingEntries) {
      await onSave(referenceEntryToTranslationResult(entry));
    }

    setSavingIds((current) => {
      const next = new Set(current);
      for (const entry of missingEntries) {
        next.delete(entry.id);
      }
      return next;
    });
  };

  return (
    <section className="progress-page">
      <div className="progress-language-tabs" aria-label="Fortschritt Sprache">
        {progressLanguages.map((option) => (
          <button
            key={option.value}
            type="button"
            className={language === option.value ? `active ${option.value === "pt-BR" ? "portuguese" : "english"}` : ""}
            onClick={() => changeLanguage(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="progress-hero">
        <div>
          <span className="eyebrow">{selectedLanguageLabel}</span>
          <h2>Geschätztes Wortschatzniveau: {summary.estimatedLevelLabel}</h2>
          <p>{summary.currentLevelLabel}</p>
        </div>

        <div className="progress-hero-meter" aria-label={`Gesamtfortschritt ${summary.overallPercent} Prozent`}>
          <strong>{summary.overallPercent}%</strong>
          <div className="progress-bar">
            <span style={{ width: `${summary.overallPercent}%` }} />
          </div>
          <small>
            {summary.masteredReferenceLemmas} von {summary.referenceCount} Referenzwörtern beherrscht
          </small>
        </div>

        <div className="progress-hero-stats">
          <span>Gespeichert: {summary.savedWords}</span>
          <span>Beherrscht: {summary.masteredWords}</span>
          <span>Außerhalb Referenz: {summary.outsideReferenceCount}</span>
          <span>Version: {summary.referenceVersion}</span>
        </div>
      </div>

      <p className="progress-note">
        Die Einstufung zeigt deinen geschätzten Wortschatzfortschritt. Sie ersetzt keinen vollständigen Sprachtest nach GER, da Grammatik,
        Hören, Lesen, Schreiben und Sprechen nicht vollständig bewertet werden.
      </p>

      <div className="progress-metrics">
        <Metric label="Referenzwortschatz" value={summary.referenceCount} />
        <Metric label="Gespeicherte Referenzlemmata" value={summary.savedReferenceLemmas} />
        <Metric label="Beherrschte Referenzlemmata" value={summary.masteredReferenceLemmas} />
        <Metric label="Eindeutige Lemmata" value={summary.uniqueSavedLemmas} />
        <Metric label="Gespeicherte Bedeutungen" value={summary.savedMeanings} />
        <Metric label="Beherrschte Bedeutungen" value={summary.masteredMeanings} />
        <Metric label="Gespeicherte Wendungen" value={summary.savedPhrases} />
        <Metric label="Beherrschte Wendungen" value={summary.masteredPhrases} />
        <Metric label="Gespeicherte Sätze" value={summary.savedSentences} />
        <Metric label="Beherrschte Sätze" value={summary.masteredSentences} />
        <Metric label="Nicht eingestuft" value={summary.unassignedCount} />
        <Metric label="Regel abgeschlossen ab" value={`${progressCompletionThreshold}%`} />
      </div>

      {!referenceEntries.length ? (
        <div className="empty-state progress-empty">
          <p>Für diese Sprache ist noch kein Referenzwortschatz vorhanden. Importiere zuerst eine geprüfte Referenzdatei.</p>
        </div>
      ) : (
        <>
          <div className="level-list">
            {summary.levels.map((levelProgress) => (
              <article className="level-row" key={levelProgress.level}>
                <button
                  type="button"
                  className="level-row-main"
                  onClick={() => setSelectedLevel((current) => (current === levelProgress.level ? null : levelProgress.level))}
                >
                  <strong>{levelProgress.level}</strong>
                  <span>{levelProgress.masteredCount} beherrscht</span>
                  <span>{levelProgress.savedCount} gespeichert</span>
                  <span>{levelProgress.missingCount} fehlt</span>
                  <div className="level-progress">
                    <span>{levelProgress.percent}%</span>
                    <div className="progress-bar">
                      <span style={{ width: `${levelProgress.percent}%` }} />
                    </div>
                  </div>
                  {selectedLevel === levelProgress.level ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>

                <button className="level-add-button" type="button" onClick={() => addMissingLevelEntries(levelProgress.level)}>
                  <BookPlus size={16} />
                  <span>Fehlende hinzufügen</span>
                </button>
              </article>
            ))}
          </div>

          {selectedLevel && (
            <div className="reference-detail">
              <div className="reference-detail-head">
                <div>
                  <span className="eyebrow">{selectedLanguageLabel}</span>
                  <h3>{selectedLevel}-Wortschatz</h3>
                </div>
                <span>{filteredReferenceEntries.length} Einträge</span>
              </div>

              <div className="reference-filters">
                <label className="search-field">
                  <span>Suche</span>
                  <div>
                    <Search size={16} />
                    <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Wort, Bedeutung..." />
                  </div>
                </label>

                <label>
                  <span>Thema</span>
                  <select value={topic} onChange={(event) => setTopic(event.target.value)}>
                    <option value="all">Alle Themen</option>
                    {topics.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Status</span>
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ReferenceStatusFilter)}>
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Wortart</span>
                  <select value={partOfSpeech} onChange={(event) => setPartOfSpeech(event.target.value)}>
                    <option value="all">Alle Wortarten</option>
                    {partsOfSpeech.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Sortierung</span>
                  <select value={sort} onChange={(event) => setSort(event.target.value as ReferenceSort)}>
                    <option value="frequency">Häufigkeit</option>
                    <option value="alphabetical">Alphabetisch</option>
                    <option value="status">Lernstatus</option>
                  </select>
                </label>
              </div>

              <div className="reference-list">
                {!filteredReferenceEntries.length && (
                  <div className="empty-state compact">
                    <p>Keine Referenzwörter für diese Auswahl.</p>
                  </div>
                )}

                {filteredReferenceEntries.map((entry) => {
                  const status = getReferenceStatus(entry, userLemmas);
                  const saving = savingIds.has(entry.id);

                  return (
                    <article className={`reference-row ${status}`} key={entry.id}>
                      <div className="reference-word">
                        <strong>{entry.lemma}</strong>
                        <span>{entry.translation}</span>
                      </div>

                      <div className="reference-info">
                        <span>
                          {entry.partOfSpeech} · {entry.cefrLevel}
                        </span>
                        <p>{entry.meaning}</p>
                        {entry.exampleSentence && <small>{entry.exampleSentence}</small>}
                      </div>

                      <div className="reference-tags">
                        {entry.topics.map((item) => (
                          <span key={item}>{item}</span>
                        ))}
                      </div>

                      <div className="reference-status">
                        <span>{getStatusLabel(status)}</span>
                        {status === "missing" ? (
                          <button type="button" onClick={() => addReferenceEntry(entry)} disabled={saving}>
                            {saving ? <Loader2 className="spin" size={15} /> : <Plus size={15} />}
                            Hinzufügen
                          </button>
                        ) : (
                          <button type="button" disabled>
                            <CheckCircle2 size={15} />
                            Gespeichert
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="progress-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getUserLemmaMap(entries: VocabularyEntry[], language: StudyLanguageCode, settings: ReviewSettings) {
  const map = new Map<string, { saved: boolean; mastered: boolean }>();

  for (const entry of entries) {
    if (getEntryStudyLanguage(entry) !== language) {
      continue;
    }

    const lemma = getEntryNormalizedLemma(entry, language);

    if (!lemma) {
      continue;
    }

    const current = map.get(lemma);
    const mastered = isMasteredByExistingSrs(entry, settings);

    map.set(lemma, {
      saved: true,
      mastered: current?.mastered || mastered,
    });
  }

  return map;
}

function getReferenceStatus(entry: ReferenceLexiconEntry, userLemmas: Map<string, { saved: boolean; mastered: boolean }>) {
  const status = userLemmas.get(entry.normalizedLemma);

  if (status?.mastered) {
    return "mastered";
  }

  if (status?.saved) {
    return "saved";
  }

  return "missing";
}

function getStatusLabel(status: "mastered" | "saved" | "missing") {
  if (status === "mastered") {
    return "Beherrscht";
  }

  if (status === "saved") {
    return "Gespeichert";
  }

  return "Nicht gespeichert";
}

function sortReferenceEntries(
  a: ReferenceLexiconEntry,
  b: ReferenceLexiconEntry,
  sort: ReferenceSort,
  userLemmas: Map<string, { saved: boolean; mastered: boolean }>,
) {
  if (sort === "alphabetical") {
    return a.lemma.localeCompare(b.lemma, "de");
  }

  if (sort === "status") {
    return statusRank(getReferenceStatus(a, userLemmas)) - statusRank(getReferenceStatus(b, userLemmas));
  }

  return b.frequencyScore - a.frequencyScore;
}

function statusRank(status: "mastered" | "saved" | "missing") {
  if (status === "missing") {
    return 0;
  }

  if (status === "saved") {
    return 1;
  }

  return 2;
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "de"));
}

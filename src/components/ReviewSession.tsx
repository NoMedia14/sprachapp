import { ArrowRight, Check, Eye, RotateCcw, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import { applyReviewGrade, isDue } from "../services/spacedRepetition";
import type { LanguageCode, ReviewGrade, ReviewSettings, VocabularyEntry, VocabularyFilters } from "../types";
import { HighlightedExample } from "./HighlightedExample";

interface ReviewSessionProps {
  entries: VocabularyEntry[];
  settings: ReviewSettings;
  onReview: (entry: VocabularyEntry) => Promise<void>;
}

type ReviewMode = "due" | "targeted";

const defaultFilters: VocabularyFilters = {
  language: "all",
  category: "all",
  subcategory: "all",
};

const gradeOptions: Array<{ grade: ReviewGrade; label: string; icon: typeof RotateCcw }> = [
  { grade: "again", label: "Nochmal", icon: RotateCcw },
  { grade: "good", label: "Gut", icon: Check },
  { grade: "easy", label: "Leicht", icon: Zap },
];

const languageLabel: Record<LanguageCode, string> = {
  de: "Deutsch",
  "pt-BR": "Portugiesisch",
  en: "Englisch",
};

const languageFilterOptions: Array<{ value: VocabularyFilters["language"]; label: string }> = [
  { value: "all", label: "Alle Sprachen" },
  { value: "pt-BR", label: "Portugiesisch" },
  { value: "en", label: "Englisch" },
];

export function ReviewSession({ entries, settings, onReview }: ReviewSessionProps) {
  const [revealed, setRevealed] = useState(false);
  const [mode, setMode] = useState<ReviewMode>("due");
  const [filters, setFilters] = useState<VocabularyFilters>(defaultFilters);
  const categories = useMemo(() => uniqueValues(entries.map((entry) => entry.category)), [entries]);
  const subcategories = useMemo(
    () =>
      uniqueValues(
        entries
          .filter((entry) => filters.category === "all" || entry.category === filters.category)
          .map((entry) => entry.subcategory),
      ),
    [entries, filters.category],
  );

  const reviewEntries = useMemo(
    () =>
      entries
        .filter((entry) => mode === "targeted" || isDue(entry))
        .filter((entry) => matchesFilters(entry, filters))
        .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()),
    [entries, filters, mode],
  );
  const activeEntry = reviewEntries[0];

  const review = async (grade: ReviewGrade) => {
    if (!activeEntry) {
      return;
    }

    await onReview(applyReviewGrade(activeEntry, grade, settings));
    setRevealed(false);
  };

  const updateFilter = <Key extends keyof VocabularyFilters>(key: Key, value: VocabularyFilters[Key]) => {
    setRevealed(false);
    setFilters((current) => {
      const next = {
        ...current,
        [key]: value,
      };

      if (key === "category") {
        next.subcategory = "all";
      }

      return next;
    });
  };

  return (
    <section className="review-panel">
      <div className="review-controls">
        <div className="segmented review-mode-toggle">
          <button type="button" className={mode === "due" ? "active" : ""} onClick={() => setMode("due")}>
            Fällig
          </button>
          <button type="button" className={mode === "targeted" ? "active" : ""} onClick={() => setMode("targeted")}>
            Gezielt
          </button>
        </div>

        <div className="filter-bar compact">
          <label>
            <span>Sprache</span>
            <select value={filters.language} onChange={(event) => updateFilter("language", event.target.value as VocabularyFilters["language"])}>
              {languageFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Kategorie</span>
            <select value={filters.category} onChange={(event) => updateFilter("category", event.target.value)}>
              <option value="all">Alle Kategorien</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Unterkategorie</span>
            <select value={filters.subcategory} onChange={(event) => updateFilter("subcategory", event.target.value)}>
              <option value="all">Alle Unterkategorien</option>
              {subcategories.map((subcategory) => (
                <option key={subcategory} value={subcategory}>
                  {subcategory}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {!activeEntry ? (
        <div className="empty-state">
          <Check size={28} />
          <p>{mode === "due" ? "Keine Wörter sind für diese Auswahl fällig." : "Keine Wörter für diese Auswahl."}</p>
        </div>
      ) : (
        <>
          <div className="review-topline">
            <span>{reviewEntries.length} Karten</span>
            <span>
              {activeEntry.category} · {activeEntry.subcategory}
            </span>
            <span>Wiederholungen: {activeEntry.repetitions}</span>
          </div>

          <div className="flashcard">
            <span className="eyebrow">
              {languageLabel[activeEntry.sourceLanguage]} → {languageLabel[activeEntry.targetLanguage]}
            </span>

            <div className={`review-word-grid ${revealed ? "revealed" : ""}`}>
              <div className="review-word-side source">
                <span>{languageLabel[activeEntry.sourceLanguage]}</span>
                <strong>{activeEntry.term}</strong>
              </div>

              <ArrowRight className="review-direction-icon" aria-hidden="true" size={22} />

              <div className={`review-word-side target ${revealed ? "" : "concealed"}`}>
                <span>{languageLabel[activeEntry.targetLanguage]}</span>
                {revealed ? (
                  <strong>{activeEntry.translation}</strong>
                ) : (
                  <button className="reveal-button" type="button" onClick={() => setRevealed(true)}>
                    <Eye size={18} />
                    Antwort zeigen
                  </button>
                )}
              </div>
            </div>

            {revealed ? (
              <div className="review-examples">
                <div className="review-example source">
                  <span>Beispiel · {languageLabel[activeEntry.sourceLanguage]}</span>
                  <p>
                    <HighlightedExample sentence={activeEntry.exampleSource} term={activeEntry.term} />
                  </p>
                </div>
                {activeEntry.exampleTarget && (
                  <div className="review-example target">
                    <span>Beispiel · {languageLabel[activeEntry.targetLanguage]}</span>
                    <p>
                      <HighlightedExample sentence={activeEntry.exampleTarget} term={activeEntry.translation} />
                    </p>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {revealed && (
            <div className="grade-grid">
              {gradeOptions.map(({ grade, label, icon: Icon }) => (
                <button type="button" key={grade} onClick={() => review(grade)}>
                  <Icon size={17} />
                  {label}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function matchesFilters(entry: VocabularyEntry, filters: VocabularyFilters) {
  const languageMatches =
    filters.language === "all" || entry.sourceLanguage === filters.language || entry.targetLanguage === filters.language;
  const categoryMatches = filters.category === "all" || entry.category === filters.category;
  const subcategoryMatches = filters.subcategory === "all" || entry.subcategory === filters.subcategory;

  return languageMatches && categoryMatches && subcategoryMatches;
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "de"));
}

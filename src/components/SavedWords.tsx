import { Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { LanguageCode, VocabularyEntry, VocabularyFilters } from "../types";

interface SavedWordsProps {
  entries: VocabularyEntry[];
  onDelete: (id: string) => Promise<void>;
}

const defaultFilters: VocabularyFilters = {
  language: "all",
  category: "all",
  subcategory: "all",
};

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

export function SavedWords({ entries, onDelete }: SavedWordsProps) {
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

  const filteredEntries = useMemo(
    () =>
      entries.filter((entry) => {
        const languageMatches =
          filters.language === "all" || entry.sourceLanguage === filters.language || entry.targetLanguage === filters.language;
        const categoryMatches = filters.category === "all" || entry.category === filters.category;
        const subcategoryMatches = filters.subcategory === "all" || entry.subcategory === filters.subcategory;

        return languageMatches && categoryMatches && subcategoryMatches;
      }),
    [entries, filters],
  );

  if (!entries.length) {
    return (
      <section className="section-band">
        <div className="empty-state">
          <p>Noch keine Wörter gespeichert.</p>
        </div>
      </section>
    );
  }

  const updateFilter = <Key extends keyof VocabularyFilters>(key: Key, value: VocabularyFilters[Key]) => {
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
    <section className="words-section">
      <div className="filter-bar">
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

      <div className="word-list compact">
        {!filteredEntries.length && (
          <div className="empty-state compact">
            <p>Keine Wörter für diesen Filter.</p>
          </div>
        )}

        {filteredEntries.map((entry) => {
          const germanWord = getGermanWord(entry);
          const otherWord = getOtherWord(entry);
          const otherLanguage = getOtherLanguage(entry);

          return (
            <article className="word-list-row compact" key={entry.id}>
              <div className="word-cell german-word-cell">
                <span>Deutsch</span>
                <strong>{germanWord}</strong>
              </div>

              <div className={`word-cell other-word-cell ${getLanguageTone(otherLanguage)}`}>
                <span>{languageLabel[otherLanguage]}</span>
                <strong>{otherWord}</strong>
              </div>

              <div className="word-cell category-cell">
                <span>Kategorie</span>
                <strong>{entry.category}</strong>
                <small>{entry.subcategory}</small>
              </div>

              <div className="word-cell word-example-cell">
                <span>Beispiel</span>
                <p>{entry.exampleSource}</p>
                {entry.exampleTarget && <p>{entry.exampleTarget}</p>}
              </div>

              <div className="word-cell word-due-cell">
                <span>Fälligkeit</span>
                <strong>{new Date(entry.dueAt).toLocaleDateString("de-DE")}</strong>
              </div>

              <button
                className="icon-button subtle delete-word-button"
                type="button"
                onClick={() => onDelete(entry.id)}
                aria-label="Löschen"
                title="Löschen"
              >
                <Trash2 size={14} />
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "de"));
}

function getGermanWord(entry: VocabularyEntry) {
  if (entry.sourceLanguage === "de") {
    return entry.term;
  }

  if (entry.targetLanguage === "de") {
    return entry.translation;
  }

  return "-";
}

function getOtherWord(entry: VocabularyEntry) {
  if (entry.sourceLanguage === "de") {
    return entry.translation;
  }

  if (entry.targetLanguage === "de") {
    return entry.term;
  }

  return `${entry.term} / ${entry.translation}`;
}

function getOtherLanguage(entry: VocabularyEntry): LanguageCode {
  if (entry.sourceLanguage === "de") {
    return entry.targetLanguage;
  }

  return entry.sourceLanguage;
}

function getLanguageTone(language: LanguageCode) {
  if (language === "pt-BR") {
    return "portuguese";
  }

  if (language === "en") {
    return "english";
  }

  return "german";
}

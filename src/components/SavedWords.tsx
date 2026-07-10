import { Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { LanguageCode, VocabularyEntry } from "../types";

interface SavedWordsProps {
  entries: VocabularyEntry[];
  onDelete: (id: string) => Promise<void>;
}

type WordFilter = "all" | "pt-BR" | "en";

const languageLabel: Record<LanguageCode, string> = {
  de: "Deutsch",
  "pt-BR": "Portugiesisch",
  en: "Englisch",
};

const filterOptions: Array<{ value: WordFilter; label: string }> = [
  { value: "all", label: "Alle" },
  { value: "pt-BR", label: "Portugiesisch" },
  { value: "en", label: "Englisch" },
];

export function SavedWords({ entries, onDelete }: SavedWordsProps) {
  const [filter, setFilter] = useState<WordFilter>("all");
  const filteredEntries = useMemo(() => {
    if (filter === "all") {
      return entries;
    }

    return entries.filter((entry) => entry.sourceLanguage === filter || entry.targetLanguage === filter);
  }, [entries, filter]);

  if (!entries.length) {
    return (
      <section className="section-band">
        <div className="empty-state">
          <p>Noch keine Wörter gespeichert.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="words-section">
      <div className="word-filter">
        {filterOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            className={filter === option.value ? "active" : ""}
            onClick={() => setFilter(option.value)}
          >
            {option.label}
          </button>
        ))}
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

          return (
            <article className="word-list-row compact" key={entry.id}>
              <div className="word-cell word-language">
                <span>{languageLabel[entry.sourceLanguage]}</span>
                <strong>{languageLabel[entry.targetLanguage]}</strong>
              </div>

              <div className="word-cell">
                <span>Deutsch</span>
                <strong>{germanWord}</strong>
              </div>

              <div className="word-cell">
                <span>Andere Sprache</span>
                <strong>{otherWord}</strong>
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
                className="icon-button subtle"
                type="button"
                onClick={() => onDelete(entry.id)}
                aria-label="Löschen"
                title="Löschen"
              >
                <Trash2 size={16} />
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
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

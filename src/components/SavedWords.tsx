import { Trash2 } from "lucide-react";
import type { VocabularyEntry } from "../types";

interface SavedWordsProps {
  entries: VocabularyEntry[];
  onDelete: (id: string) => Promise<void>;
}

const languageLabel = {
  de: "Deutsch",
  "pt-BR": "Portugiesisch BR",
};

export function SavedWords({ entries, onDelete }: SavedWordsProps) {
  if (!entries.length) {
    return (
      <section className="section-band">
        <div className="empty-state">
          <p>Noch keine Woerter gespeichert.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="word-list">
      {entries.map((entry) => (
        <article className="word-list-row" key={entry.id}>
          <div className="word-main">
            <span className="eyebrow">
              {languageLabel[entry.sourceLanguage]} {"->"} {languageLabel[entry.targetLanguage]}
            </span>
            <div className="word-pair">
              <strong>{entry.term}</strong>
              <span>{entry.translation}</span>
            </div>
          </div>

          <p className="muted-text word-example">{entry.exampleSource}</p>

          <div className="word-meta">
            <span>Intervall: {entry.intervalDays} Tage</span>
            <span>Fällig: {new Date(entry.dueAt).toLocaleDateString("de-DE")}</span>
            <button
              className="icon-button subtle"
              type="button"
              onClick={() => onDelete(entry.id)}
              aria-label="Löschen"
              title="Löschen"
            >
              <Trash2 size={17} />
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}

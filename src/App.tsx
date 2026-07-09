import { BookMarked, Library, RotateCcw, Settings, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ReviewSession } from "./components/ReviewSession";
import { SavedWords } from "./components/SavedWords";
import { SettingsPanel } from "./components/SettingsPanel";
import { WordLookup } from "./components/WordLookup";
import { createInitialReviewState, defaultReviewSettings, isDue } from "./services/spacedRepetition";
import {
  deleteVocabularyEntry,
  loadVocabulary,
  saveVocabularyEntry,
  updateVocabularyEntry,
} from "./services/vocabularyRepository";
import type { ReviewSettings, TranslationResult, VocabularyEntry } from "./types";

type View = "lookup" | "review" | "words" | "settings";

const settingsStorageKey = "sprachapp:review-settings";

const navItems: Array<{ view: View; label: string; icon: typeof Sparkles }> = [
  { view: "lookup", label: "Nachschlagen", icon: Sparkles },
  { view: "review", label: "Wiederholung", icon: RotateCcw },
  { view: "words", label: "Wörter", icon: Library },
  { view: "settings", label: "Einstellungen", icon: Settings },
];

export default function App() {
  const [view, setView] = useState<View>("lookup");
  const [entries, setEntries] = useState<VocabularyEntry[]>([]);
  const [settings, setSettings] = useState<ReviewSettings>(() => {
    const raw = localStorage.getItem(settingsStorageKey);
    return raw ? { ...defaultReviewSettings, ...JSON.parse(raw) } : defaultReviewSettings;
  });

  const dueCount = useMemo(() => entries.filter((entry) => isDue(entry)).length, [entries]);

  useEffect(() => {
    loadVocabulary().then(setEntries);
  }, []);

  const saveSettings = (nextSettings: ReviewSettings) => {
    setSettings(nextSettings);
    localStorage.setItem(settingsStorageKey, JSON.stringify(nextSettings));
  };

  const saveTranslation = async (result: TranslationResult) => {
    const existing = entries.find(
      (entry) =>
        entry.term.toLowerCase() === result.term.toLowerCase() &&
        entry.sourceLanguage === result.sourceLanguage,
    );

    const entry: VocabularyEntry = {
      ...createInitialReviewState(),
      ...result,
      id: existing?.id ?? crypto.randomUUID(),
      tags: existing?.tags ?? [],
    };

    await saveVocabularyEntry(entry);
    setEntries((current) => [entry, ...current.filter((candidate) => candidate.id !== entry.id)]);
  };

  const reviewEntry = async (entry: VocabularyEntry) => {
    await updateVocabularyEntry(entry);
    setEntries((current) => current.map((candidate) => (candidate.id === entry.id ? entry : candidate)));
  };

  const deleteEntry = async (id: string) => {
    await deleteVocabularyEntry(id);
    setEntries((current) => current.filter((entry) => entry.id !== id));
  };

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <BookMarked size={25} />
          <div>
            <strong>Sprachapp</strong>
            <span>Deutsch und Português BR</span>
          </div>
        </div>

        <nav>
          {navItems.map(({ view: itemView, label, icon: Icon }) => (
            <button
              key={itemView}
              type="button"
              aria-label={label}
              className={view === itemView ? "active" : ""}
              onClick={() => setView(itemView)}
            >
              <Icon size={18} />
              {label}
              {itemView === "review" && dueCount > 0 && <span className="badge">{dueCount}</span>}
            </button>
          ))}
        </nav>
      </aside>

      <section className="content">
        <header className="content-header">
          <div>
            <span className="eyebrow">Vokabeltraining</span>
            <h1>{navItems.find((item) => item.view === view)?.label}</h1>
          </div>
          <div className="stats-strip">
            <span>{entries.length} Wörter</span>
            <span>{dueCount} fällig</span>
          </div>
        </header>

        {view === "lookup" && <WordLookup onSave={saveTranslation} />}
        {view === "review" && <ReviewSession entries={entries} settings={settings} onReview={reviewEntry} />}
        {view === "words" && <SavedWords entries={entries} onDelete={deleteEntry} />}
        {view === "settings" && <SettingsPanel settings={settings} onChange={saveSettings} />}
      </section>
    </main>
  );
}

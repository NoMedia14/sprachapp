import type { User } from "@supabase/supabase-js";
import { BarChart3, BookMarked, Library, LogOut, RotateCcw, Settings, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AuthPanel } from "./components/AuthPanel";
import { CostWidget } from "./components/CostWidget";
import { ProgressDashboard } from "./components/ProgressDashboard";
import { ReviewSession } from "./components/ReviewSession";
import { SavedWords } from "./components/SavedWords";
import { SettingsPanel } from "./components/SettingsPanel";
import { WordLookup } from "./components/WordLookup";
import { supabase } from "./lib/supabase";
import { createInitialReviewState, defaultReviewSettings, isDue } from "./services/spacedRepetition";
import { loadLocalReviewSettings, loadReviewSettings, saveReviewSettings } from "./services/settingsRepository";
import { emptyUsageSummary, loadMonthlyUsageSummary, type MonthlyUsageSummary } from "./services/usageRepository";
import {
  deleteVocabularyEntry,
  loadVocabulary,
  saveVocabularyEntry,
  updateVocabularyEntry,
} from "./services/vocabularyRepository";
import type { ReviewSettings, TranslationResult, VocabularyEntry } from "./types";

type View = "lookup" | "review" | "words" | "progress" | "settings";

const costWidgetStorageKey = "sprachapp:cost-widget-hidden";

const navItems: Array<{ view: View; label: string; icon: typeof Sparkles }> = [
  { view: "lookup", label: "Nachschlagen", icon: Sparkles },
  { view: "review", label: "Wiederholung", icon: RotateCcw },
  { view: "words", label: "Wörter", icon: Library },
  { view: "progress", label: "Fortschritt", icon: BarChart3 },
  { view: "settings", label: "Einstellungen", icon: Settings },
];

export default function App() {
  const [view, setView] = useState<View>("lookup");
  const [entries, setEntries] = useState<VocabularyEntry[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!supabase);
  const [usageSummary, setUsageSummary] = useState<MonthlyUsageSummary>(emptyUsageSummary);
  const [costWidgetHidden, setCostWidgetHidden] = useState(() => {
    return localStorage.getItem(costWidgetStorageKey) === "true";
  });
  const [settings, setSettings] = useState<ReviewSettings>(() => loadLocalReviewSettings());

  const dueCount = useMemo(() => entries.filter((entry) => isDue(entry)).length, [entries]);

  const refreshVocabulary = async () => {
    setEntries(await loadVocabulary());
  };

  const refreshUsage = useCallback(async () => {
    setUsageSummary(await loadMonthlyUsageSummary());
  }, []);

  const refreshSettings = useCallback(async () => {
    setSettings(await loadReviewSettings());
  }, []);

  useEffect(() => {
    if (!supabase) {
      refreshVocabulary();
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setAuthReady(true);
      if (data.session?.user) {
        refreshVocabulary();
        refreshUsage();
        refreshSettings();
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        refreshVocabulary();
        refreshUsage();
        refreshSettings();
      } else {
        setEntries([]);
        setUsageSummary(emptyUsageSummary);
        setSettings(defaultReviewSettings);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const saveSettings = async (nextSettings: ReviewSettings) => {
    setSettings(nextSettings);
    await saveReviewSettings(nextSettings);
  };

  const handleSignedIn = async () => {
    await Promise.all([refreshVocabulary(), refreshUsage(), refreshSettings()]);
  };

  const toggleCostWidget = () => {
    setCostWidgetHidden((current) => {
      const next = !current;
      localStorage.setItem(costWidgetStorageKey, String(next));
      return next;
    });
  };

  const saveTranslation = async (result: TranslationResult) => {
    const existing = entries.find(
      (entry) =>
        entry.term.toLowerCase() === result.term.toLowerCase() &&
        entry.sourceLanguage === result.sourceLanguage &&
        entry.targetLanguage === result.targetLanguage,
    );

    const entry: VocabularyEntry = {
      ...createInitialReviewState(),
      ...result,
      id: existing?.id ?? crypto.randomUUID(),
      tags: existing?.tags ?? [],
    };

    await saveVocabularyEntry(entry);
    setEntries((current) => [entry, ...current.filter((candidate) => candidate.id !== entry.id)]);
    await refreshUsage();
  };

  const reviewEntry = async (entry: VocabularyEntry) => {
    await updateVocabularyEntry(entry);
    setEntries((current) => current.map((candidate) => (candidate.id === entry.id ? entry : candidate)));
  };

  const deleteEntry = async (id: string) => {
    await deleteVocabularyEntry(id);
    setEntries((current) => current.filter((entry) => entry.id !== id));
  };

  const signOut = async () => {
    await supabase?.auth.signOut();
    setEntries([]);
  };

  if (!authReady) {
    return (
      <main className="auth-shell">
        <div className="auth-card">
          <p>Lade Account...</p>
        </div>
      </main>
    );
  }

  if (supabase && !user) {
    return <AuthPanel onSignedIn={handleSignedIn} />;
  }

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
              <span className="nav-label">{label}</span>
              {itemView === "review" && dueCount > 0 && <span className="badge">{dueCount}</span>}
            </button>
          ))}
        </nav>

        {user && (
          <>
            <CostWidget hidden={costWidgetHidden} summary={usageSummary} onToggle={toggleCostWidget} />
            <div className="account-box">
              <span>{user.email}</span>
              <button type="button" onClick={signOut}>
                <LogOut size={16} />
                <span>Abmelden</span>
              </button>
            </div>
          </>
        )}
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

        {view === "lookup" && <WordLookup onSave={saveTranslation} onTranslated={refreshUsage} />}
        {view === "review" && <ReviewSession entries={entries} settings={settings} onReview={reviewEntry} />}
        {view === "words" && <SavedWords entries={entries} onDelete={deleteEntry} />}
        {view === "progress" && <ProgressDashboard entries={entries} settings={settings} onSave={saveTranslation} />}
        {view === "settings" && <SettingsPanel settings={settings} onChange={saveSettings} />}
      </section>
    </main>
  );
}

import { Check, Eye, RotateCcw, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import { applyReviewGrade, isDue } from "../services/spacedRepetition";
import type { ReviewGrade, ReviewSettings, VocabularyEntry } from "../types";
import { HighlightedExample } from "./HighlightedExample";

interface ReviewSessionProps {
  entries: VocabularyEntry[];
  settings: ReviewSettings;
  onReview: (entry: VocabularyEntry) => Promise<void>;
}

const gradeOptions: Array<{ grade: ReviewGrade; label: string; icon: typeof RotateCcw }> = [
  { grade: "again", label: "Nochmal", icon: RotateCcw },
  { grade: "good", label: "Gut", icon: Check },
  { grade: "easy", label: "Leicht", icon: Zap },
];

export function ReviewSession({ entries, settings, onReview }: ReviewSessionProps) {
  const dueEntries = useMemo(
    () => entries.filter((entry) => isDue(entry)).sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()),
    [entries],
  );
  const [revealed, setRevealed] = useState(false);
  const activeEntry = dueEntries[0];

  const review = async (grade: ReviewGrade) => {
    if (!activeEntry) {
      return;
    }

    await onReview(applyReviewGrade(activeEntry, grade, settings));
    setRevealed(false);
  };

  if (!activeEntry) {
    return (
      <section className="review-panel">
        <div className="empty-state">
          <Check size={28} />
          <p>Keine Wörter sind fällig.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="review-panel">
      <div className="review-topline">
        <span>{dueEntries.length} fällig</span>
        <span>Wiederholungen: {activeEntry.repetitions}</span>
      </div>

      <div className="flashcard">
        <span className="eyebrow">Karte</span>
        <h2>{activeEntry.term}</h2>

        {revealed ? (
          <div className="answer-area">
            <p className="translation-line">{activeEntry.translation}</p>
            <p>
              <HighlightedExample sentence={activeEntry.exampleSource} term={activeEntry.term} />
            </p>
          </div>
        ) : (
          <button className="reveal-button" type="button" onClick={() => setRevealed(true)}>
            <Eye size={18} />
            Antwort zeigen
          </button>
        )}
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
    </section>
  );
}

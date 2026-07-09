import { BookOpen, Check, Loader2, Save } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { type LanguageSelection, translateWord } from "../services/translationService";
import type { TranslationResult } from "../types";
import { HighlightedExample } from "./HighlightedExample";

interface WordLookupProps {
  onSave: (result: TranslationResult) => Promise<void>;
}

const languageOptions: Array<{ value: LanguageSelection; label: string }> = [
  { value: "auto", label: "Auto" },
  { value: "de", label: "Deutsch" },
  { value: "pt-BR", label: "Português" },
];

export function WordLookup({ onSave }: WordLookupProps) {
  const [term, setTerm] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState<LanguageSelection>("auto");
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [lookupStatus, setLookupStatus] = useState<"idle" | "loading">("idle");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState("");
  const saveResetTimer = useRef<number | null>(null);

  useEffect(() => {
    const cleanTerm = term.trim();

    if (cleanTerm.length < 2) {
      setResult(null);
      setLookupStatus("idle");
      setError("");
      return;
    }

    let active = true;
    setLookupStatus("loading");
    setError("");
    setSaveStatus("idle");

    const timeoutId = window.setTimeout(async () => {
      try {
        const translation = await translateWord(cleanTerm, sourceLanguage);

        if (active) {
          setResult(translation);
          setLookupStatus("idle");
        }
      } catch {
        if (active) {
          setError("Die Übersetzung konnte gerade nicht geladen werden.");
          setLookupStatus("idle");
        }
      }
    }, 450);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [term, sourceLanguage]);

  useEffect(() => {
    return () => {
      if (saveResetTimer.current) {
        window.clearTimeout(saveResetTimer.current);
      }
    };
  }, []);

  const save = async () => {
    if (!result || saveStatus === "saving") {
      return;
    }

    setSaveStatus("saving");
    await onSave(result);
    setSaveStatus("saved");

    if (saveResetTimer.current) {
      window.clearTimeout(saveResetTimer.current);
    }

    saveResetTimer.current = window.setTimeout(() => setSaveStatus("idle"), 1200);
  };

  return (
    <section className="lookup-card">
      <div className="lookup-top">
        <label htmlFor="term">Wort</label>
        <input
          id="term"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="z. B. janela, arbeiten, saudade"
          autoComplete="off"
        />

        <div className="language-toggle" aria-label="Ausgangssprache">
          {languageOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={sourceLanguage === option.value ? "active" : ""}
              onClick={() => setSourceLanguage(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="lookup-result">
        {lookupStatus === "loading" && (
          <div className="loading-line">
            <Loader2 className="spin" size={17} />
            Übersetze...
          </div>
        )}

        {error && <p className="error-text">{error}</p>}

        {!result && lookupStatus === "idle" && !error && (
          <div className="compact-empty">
            <BookOpen size={20} />
            <span>Tippe ein Wort ein.</span>
          </div>
        )}

        {result && (
          <>
            <div className="result-heading compact">
              <div>
                <span className="eyebrow">Übersetzung</span>
                <h2>{result.translation}</h2>
              </div>
              <button
                className={`save-button ${saveStatus === "saved" ? "saved" : ""}`}
                type="button"
                onClick={save}
                aria-label="Speichern"
                title="Speichern"
              >
                {saveStatus === "saving" && <Loader2 className="spin" size={18} />}
                {saveStatus === "saved" && <Check size={18} />}
                {saveStatus === "idle" && <Save size={18} />}
                <span>{saveStatus === "saved" ? "Gespeichert" : "Speichern"}</span>
              </button>
            </div>

            <div className="example-block">
              <BookOpen size={18} />
              <p>
                <HighlightedExample sentence={result.exampleSource} term={result.term} />
              </p>
            </div>

            {result.exampleTarget && (
              <p className="muted-text">
                <HighlightedExample sentence={result.exampleTarget} term={result.translation} />
              </p>
            )}

            <span className="provider-pill">Quelle: {result.provider}</span>
          </>
        )}
      </div>
    </section>
  );
}

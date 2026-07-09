import type { ReviewSettings } from "../types";

interface SettingsPanelProps {
  settings: ReviewSettings;
  onChange: (settings: ReviewSettings) => void;
}

export function SettingsPanel({ settings, onChange }: SettingsPanelProps) {
  const updateAgainDelay = (value: number) => {
    onChange({ ...settings, againDelayMinutes: value });
  };

  return (
    <section className="settings-simple">
      <div>
        <span className="eyebrow">Wiederholungsplan</span>
        <div className="interval-list">
          {settings.reviewIntervalsDays.map((days) => (
            <span key={days}>
              {days} {days === 1 ? "Tag" : "Tage"}
            </span>
          ))}
        </div>
      </div>

      <label className="setting-row compact">
        <span>Nochmal nach Minuten</span>
        <input
          type="number"
          min={1}
          max={120}
          step={1}
          value={settings.againDelayMinutes}
          onChange={(event) => updateAgainDelay(Number(event.target.value))}
        />
      </label>

      <div className="review-rules">
        <span>Nochmal: bleibt heute fällig</span>
        <span>Gut: nächste Stufe</span>
        <span>Leicht: eine Stufe überspringen</span>
      </div>
    </section>
  );
}

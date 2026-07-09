import { Eye, EyeOff, WalletCards } from "lucide-react";
import type { MonthlyUsageSummary } from "../services/usageRepository";

interface CostWidgetProps {
  hidden: boolean;
  summary: MonthlyUsageSummary;
  onToggle: () => void;
}

const costFormatter = new Intl.NumberFormat("de-DE", {
  currency: "USD",
  maximumFractionDigits: 4,
  minimumFractionDigits: 4,
  style: "currency",
});

export function CostWidget({ hidden, summary, onToggle }: CostWidgetProps) {
  if (hidden) {
    return (
      <button className="cost-widget collapsed" type="button" onClick={onToggle}>
        <Eye size={16} />
        Kosten anzeigen
      </button>
    );
  }

  return (
    <section className="cost-widget" aria-label="OpenAI Kosten">
      <div className="cost-widget-top">
        <div>
          <span>OpenAI</span>
          <strong>Dieser Monat</strong>
        </div>
        <button type="button" onClick={onToggle} aria-label="Kosten ausblenden" title="Kosten ausblenden">
          <EyeOff size={16} />
        </button>
      </div>

      <div className="cost-amount">
        <WalletCards size={18} />
        <span>{costFormatter.format(summary.costUsd)}</span>
      </div>

      <p>
        {summary.translations} Übersetzungen · {summary.inputTokens + summary.outputTokens} Tokens
      </p>
    </section>
  );
}

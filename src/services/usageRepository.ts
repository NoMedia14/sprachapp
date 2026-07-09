import { supabase } from "../lib/supabase";

export interface MonthlyUsageSummary {
  translations: number;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
}

export const emptyUsageSummary: MonthlyUsageSummary = {
  translations: 0,
  costUsd: 0,
  inputTokens: 0,
  outputTokens: 0,
};

interface UsageRow {
  cost_usd: number | string | null;
  input_tokens: number | null;
  output_tokens: number | null;
}

export async function loadMonthlyUsageSummary(): Promise<MonthlyUsageSummary> {
  if (!supabase) {
    return emptyUsageSummary;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return emptyUsageSummary;
  }

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("translation_usage")
    .select("cost_usd,input_tokens,output_tokens")
    .gte("created_at", monthStart.toISOString());

  if (error || !data) {
    return emptyUsageSummary;
  }

  return (data as UsageRow[]).reduce<MonthlyUsageSummary>(
    (summary, row) => ({
      translations: summary.translations + 1,
      costUsd: summary.costUsd + Number(row.cost_usd ?? 0),
      inputTokens: summary.inputTokens + Number(row.input_tokens ?? 0),
      outputTokens: summary.outputTokens + Number(row.output_tokens ?? 0),
    }),
    emptyUsageSummary,
  );
}

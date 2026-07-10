import { supabase } from "../lib/supabase";
import { defaultReviewSettings } from "./spacedRepetition";
import type { ReviewSettings } from "../types";

const settingsStorageKey = "sprachapp:review-settings";

type DbSettings = {
  again_delay_minutes: number | null;
  review_intervals_days: number[] | null;
  easy_skip_steps: number | null;
};

export function loadLocalReviewSettings(): ReviewSettings {
  const raw = localStorage.getItem(settingsStorageKey);
  return normalizeSettings(raw ? JSON.parse(raw) : defaultReviewSettings);
}

export async function loadReviewSettings(): Promise<ReviewSettings> {
  const localSettings = loadLocalReviewSettings();

  if (!supabase) {
    return localSettings;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return localSettings;
  }

  const { data, error } = await supabase
    .from("review_settings")
    .select("again_delay_minutes,review_intervals_days,easy_skip_steps")
    .maybeSingle();

  if (!error && data) {
    const remoteSettings = fromDbSettings(data as DbSettings);
    saveLocalReviewSettings(remoteSettings);
    return remoteSettings;
  }

  await saveReviewSettings(localSettings);
  return localSettings;
}

export async function saveReviewSettings(settings: ReviewSettings) {
  const normalized = normalizeSettings(settings);
  saveLocalReviewSettings(normalized);

  if (!supabase) {
    return;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return;
  }

  await supabase.from("review_settings").upsert({
    user_id: user.id,
    again_delay_minutes: normalized.againDelayMinutes,
    review_intervals_days: normalized.reviewIntervalsDays,
    easy_skip_steps: normalized.easySkipSteps,
    updated_at: new Date().toISOString(),
  });
}

function saveLocalReviewSettings(settings: ReviewSettings) {
  localStorage.setItem(settingsStorageKey, JSON.stringify(settings));
}

function fromDbSettings(settings: DbSettings): ReviewSettings {
  return normalizeSettings({
    againDelayMinutes: settings.again_delay_minutes ?? defaultReviewSettings.againDelayMinutes,
    reviewIntervalsDays: settings.review_intervals_days ?? defaultReviewSettings.reviewIntervalsDays,
    easySkipSteps: settings.easy_skip_steps ?? defaultReviewSettings.easySkipSteps,
  });
}

function normalizeSettings(settings: ReviewSettings): ReviewSettings {
  return {
    againDelayMinutes: Number(settings.againDelayMinutes || defaultReviewSettings.againDelayMinutes),
    reviewIntervalsDays: settings.reviewIntervalsDays?.length
      ? settings.reviewIntervalsDays
      : defaultReviewSettings.reviewIntervalsDays,
    easySkipSteps: Number(settings.easySkipSteps ?? defaultReviewSettings.easySkipSteps),
  };
}

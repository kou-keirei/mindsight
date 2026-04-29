import { getSupabaseClient, isSupabaseConfigured } from "../lib/supabase.js";

function asNumberOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

function normalizeDateValue(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

export function buildSessionSummaryFromSoloResults(results, options = {}) {
  if (!results) {
    return null;
  }

  const analytics = results.analytics || {};

  return {
    user_id: options.userId || null,
    local_session_id: results.sessionId || null,
    protocol_phenomenon: "mindsight",
    protocol_type: "forced_choice_perception",
    target_type: results.category || null,
    response_mode: results.guessPolicy || null,
    deck_policy: results.deckPolicy || null,
    option_count: asNumberOrNull(results.optionCount),
    trial_count: asNumberOrNull(analytics.trialCount) ?? (Array.isArray(results.trials) ? results.trials.length : null),
    hit_rate: asNumberOrNull(analytics.firstGuessAccuracy),
    z_score: asNumberOrNull(analytics.zScore),
    p_value: asNumberOrNull(analytics.pValue),
    weighted_score: asNumberOrNull(analytics.weightedScore),
    started_at: normalizeDateValue(results.startedAt),
    ended_at: normalizeDateValue(results.endedAt),
    visibility: options.visibility || "private",
    archived_to_google_sheet: Boolean(options.archivedToGoogleSheet),
    google_sheet_id: options.googleSheetId || null,
  };
}

export function isCloudSaveAvailable() {
  return isSupabaseConfigured;
}

export async function saveSessionSummary(summaryOrResults, options = {}) {
  const client = getSupabaseClient();

  if (!client) {
    return {
      ok: false,
      reason: "supabase_not_configured",
      error: null,
    };
  }

  const summary = options.alreadyBuilt
    ? summaryOrResults
    : buildSessionSummaryFromSoloResults(summaryOrResults, options);

  if (!summary) {
    return {
      ok: false,
      reason: "missing_summary",
      error: null,
    };
  }

  try {
    const { data, error } = await client
      .from("session_summaries")
      .insert(summary)
      .select()
      .single();

    if (error) {
      return {
        ok: false,
        reason: "supabase_insert_failed",
        error,
      };
    }

    return {
      ok: true,
      data,
    };
  } catch (error) {
    return {
      ok: false,
      reason: "supabase_exception",
      error,
    };
  }
}

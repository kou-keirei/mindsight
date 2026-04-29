import assert from "node:assert/strict";

import {
  buildDotV1SoloTrialRowObjects,
  buildSoloHistoryResultsCsv,
  buildSoloResultsCsv,
  parseSoloResultsCsv,
} from "../src/lib/csv.js";
import { CATEGORIES } from "../src/lib/constants.js";
import { buildReadableTrialRows, getLiveAppendHeaders, inspectTrialsSheetSchema } from "../src/lib/googleSheets.js";
import {
  MINDSIGHT_LEGACY_V0_HEADERS,
  PSILABS_DOT_V1_HEADERS,
  denormalizeSoloRow,
} from "../src/lib/schemaRegistry.js";
import { buildSoloSessionPayload } from "../src/lib/soloSessionPayload.js";
import { DECK_POLICIES, GUESS_POLICIES, SESSION_MODES } from "../src/lib/sessionModel.js";
import { getSupabaseClient, isSupabaseConfigured, supabase } from "../src/lib/supabase.js";
import {
  buildSessionSummaryFromSoloResults,
  isCloudSaveAvailable,
  saveSessionSummary,
} from "../src/cloud/sessionSummaryCloud.js";

function parseCsvHeader(csvText) {
  return String(csvText).split(/\r?\n/)[0].split(",");
}

function buildFixtureSession(overrides = {}) {
  const startedAt = overrides.startedAt || "2026-04-27T14:00:00.000Z";
  const endedAt = overrides.endedAt || "2026-04-27T14:01:20.000Z";
  const activeOptions = CATEGORIES.Colors.items.slice(0, 6);

  return buildSoloSessionPayload({
    appMode: SESSION_MODES.SOLO,
    shareCode: null,
    sessionId: overrides.sessionId || "session-data-contract-a",
    startedAt,
    endedAt,
    name: overrides.name || "Data Contract Tester",
    category: "Colors",
    activeOptions,
    guessPolicy: overrides.guessPolicy || GUESS_POLICIES.REPEAT_UNTIL_CORRECT,
    deckPolicy: overrides.deckPolicy || DECK_POLICIES.BALANCED_DECK,
    completedResults: [
      {
        target: "Red",
        guesses: ["Blue", "Red"],
        timeToFirst: 1200,
        guessDeltas: [800],
        trialStartedAt: startedAt,
        trialEndedAt: "2026-04-27T14:00:02.000Z",
        notes: "miss then hit",
        trainingOverlayOpens: 1,
        trainingOverlayMs: 3500,
      },
      {
        target: "Green",
        guesses: ["Green"],
        timeToFirst: 900,
        guessDeltas: [],
        trialStartedAt: "2026-04-27T14:00:05.000Z",
        trialEndedAt: "2026-04-27T14:00:05.900Z",
      },
      {
        target: "Purple",
        guesses: ["Yellow", "Orange", "Purple"],
        timeToFirst: 1500,
        guessDeltas: [700, 600],
        trialStartedAt: "2026-04-27T14:00:10.000Z",
        trialEndedAt: "2026-04-27T14:00:12.800Z",
      },
    ],
  });
}

function assertThrowsWithMessage(fn, expectedText) {
  assert.throws(fn, (error) => {
    assert.match(error.message, expectedText);
    return true;
  });
}

const sessionA = buildFixtureSession();
const sessionB = buildFixtureSession({
  sessionId: "session-data-contract-b",
  name: "Second Tester",
  startedAt: "2026-04-28T09:00:00.000Z",
  endedAt: "2026-04-28T09:02:00.000Z",
  deckPolicy: DECK_POLICIES.INDEPENDENT_DRAWS,
});

const soloCsv = buildSoloResultsCsv(sessionA);
assert.deepEqual(parseCsvHeader(soloCsv), PSILABS_DOT_V1_HEADERS, "solo CSV header should be canonical dot v1 order");

const parsedSession = parseSoloResultsCsv(soloCsv);
assert.equal(parsedSession.name, sessionA.name);
assert.equal(parsedSession.category, sessionA.category);
assert.equal(parsedSession.guessPolicy, sessionA.guessPolicy);
assert.equal(parsedSession.deckPolicy, sessionA.deckPolicy);
assert.equal(parsedSession.trials.length, sessionA.trials.length);
assert.deepEqual(parsedSession.trials.map((trial) => trial.targetValue), sessionA.trials.map((trial) => trial.targetValue));
assert.deepEqual(parsedSession.trials.map((trial) => trial.guesses), sessionA.trials.map((trial) => trial.guesses));
assert.equal(parsedSession.trials[0].trialStartedAt, sessionA.trials[0].trialStartedAt);
assert.equal(parsedSession.trials[0].trialEndedAt, sessionA.trials[0].trialEndedAt);
assert.equal(parsedSession.analytics.trialCount, sessionA.analytics.trialCount);
assert.equal(parsedSession.analytics.firstGuessAccuracy, sessionA.analytics.firstGuessAccuracy);
assert.equal(parsedSession.analytics.weightedScore, sessionA.analytics.weightedScore);

const historyCsv = buildSoloHistoryResultsCsv([sessionA, sessionB]);
const historyLines = historyCsv.split(/\r?\n/);
assert.deepEqual(parseCsvHeader(historyCsv), PSILABS_DOT_V1_HEADERS, "history CSV header should be canonical dot v1 order");
assert.equal(historyLines.length, 1 + sessionA.trials.length + sessionB.trials.length);

const blankAppendTarget = getLiveAppendHeaders([]);
assert.equal(blankAppendTarget.shouldInitialize, true);
assert.deepEqual(blankAppendTarget.headers, PSILABS_DOT_V1_HEADERS);

const canonicalInspection = inspectTrialsSheetSchema(PSILABS_DOT_V1_HEADERS);
assert.equal(canonicalInspection.compatible, true);
assert.equal(canonicalInspection.canonicalOrder, true);
assert.equal(canonicalInspection.reorderedButSafe, false);
assert.equal(canonicalInspection.legacyButSafe, false);
assert.equal(canonicalInspection.upgradeAvailable, false);
assert.equal(canonicalInspection.blocked, false);

const reorderedHeaders = [
  "target.value",
  "participant.name",
  "trial.index",
  "response.attempt_sequence",
  "schema.version",
  ...PSILABS_DOT_V1_HEADERS.filter((header) => ![
    "target.value",
    "participant.name",
    "trial.index",
    "response.attempt_sequence",
    "schema.version",
  ].includes(header)),
];
const reorderedInspection = inspectTrialsSheetSchema(reorderedHeaders);
assert.equal(reorderedInspection.compatible, true);
assert.equal(reorderedInspection.canonicalOrder, false);
assert.equal(reorderedInspection.reorderedButSafe, true);
assert.equal(reorderedInspection.legacyButSafe, false);
assert.equal(reorderedInspection.upgradeAvailable, true);
assert.equal(reorderedInspection.blocked, false);

const appendTarget = getLiveAppendHeaders(reorderedHeaders);
assert.equal(appendTarget.shouldInitialize, false);
assert.deepEqual(appendTarget.headers, reorderedHeaders);

const firstRowObject = buildDotV1SoloTrialRowObjects(sessionA)[0];
const reorderedValues = denormalizeSoloRow(firstRowObject, appendTarget.headers);
const valueByHeader = Object.fromEntries(appendTarget.headers.map((header, index) => [header, reorderedValues[index]]));
assert.equal(valueByHeader["target.value"], "Red");
assert.equal(valueByHeader["participant.name"], sessionA.name);
assert.equal(valueByHeader["trial.index"], 1);
assert.equal(valueByHeader["response.attempt_sequence"], "Blue|Red");
assert.equal(valueByHeader["schema.version"], "1.0");

const readableReorderedRows = buildReadableTrialRows(reorderedHeaders, [reorderedValues]);
assert.equal(readableReorderedRows.length, 1);
assert.equal(readableReorderedRows[0].target_value, "Red");
assert.equal(readableReorderedRows[0].name, sessionA.name);
assert.equal(readableReorderedRows[0].card_index, 1);
assert.equal(readableReorderedRows[0].guesses, "Blue|Red");

const legacyRowValues = MINDSIGHT_LEGACY_V0_HEADERS.map((header) => {
  const values = {
    session_id: "legacy-session-a",
    name: "Legacy Tester",
    category: "Colors",
    card_index: "1",
    target_value: "Green",
    guesses: "Blue|Green",
    guess_policy: GUESS_POLICIES.REPEAT_UNTIL_CORRECT,
    deck_policy: DECK_POLICIES.INDEPENDENT_DRAWS,
    option_count: "6",
    option_values: "Red|Orange|Yellow|Green|Blue|Purple",
    trial_count: "1",
    started_at: "2026-04-26T12:00:00.000Z",
    ended_at: "2026-04-26T12:00:05.000Z",
  };

  return values[header] ?? "";
});
const readableLegacyRows = buildReadableTrialRows(MINDSIGHT_LEGACY_V0_HEADERS, [legacyRowValues]);
const legacyInspection = inspectTrialsSheetSchema(MINDSIGHT_LEGACY_V0_HEADERS);
assert.equal(legacyInspection.compatible, true);
assert.equal(legacyInspection.canonicalOrder, false);
assert.equal(legacyInspection.reorderedButSafe, false);
assert.equal(legacyInspection.legacyButSafe, true);
assert.equal(legacyInspection.upgradeAvailable, true);
assert.equal(legacyInspection.blocked, false);

assert.equal(readableLegacyRows.length, 1);
assert.equal(readableLegacyRows[0].session_id, "legacy-session-a");
assert.equal(readableLegacyRows[0].name, "Legacy Tester");
assert.equal(readableLegacyRows[0].target_value, "Green");
assert.equal(readableLegacyRows[0].guesses, "Blue|Green");
assert.equal(readableLegacyRows[0].first_guess, "Blue");
assert.equal(readableLegacyRows[0].correct_guess_index, 2);

const blankInspection = inspectTrialsSheetSchema(["session.id", "", "participant.name"]);
assert.equal(blankInspection.compatible, false);
assert.equal(blankInspection.blocked, true);
assert.deepEqual(blankInspection.blankHeaders, [2]);
assert.match(blankInspection.blockReasons.join("; "), /blank header cells/i);

const unknownInspection = inspectTrialsSheetSchema([...PSILABS_DOT_V1_HEADERS, "mystery.column"]);
assert.equal(unknownInspection.compatible, false);
assert.equal(unknownInspection.blocked, true);
assert.deepEqual(unknownInspection.unknownHeaders, ["mystery.column"]);
assert.match(unknownInspection.blockReasons.join("; "), /unknown columns/i);

const nonMindsightReadInspection = inspectTrialsSheetSchema(PSILABS_DOT_V1_HEADERS, {
  normalizedRows: [{ "protocol.phenomenon": "precognition" }],
});
assert.equal(nonMindsightReadInspection.compatible, true);
assert.equal(nonMindsightReadInspection.blocked, false);

const nonMindsightMigrationInspection = inspectTrialsSheetSchema(PSILABS_DOT_V1_HEADERS, {
  normalizedRows: [{ "protocol.phenomenon": "precognition" }],
  requireMigratableProtocols: true,
});
assert.equal(nonMindsightMigrationInspection.compatible, false);
assert.equal(nonMindsightMigrationInspection.blocked, true);
assert.match(nonMindsightMigrationInspection.blockReasons.join("; "), /non-Mindsight protocol rows/i);

assertThrowsWithMessage(() => getLiveAppendHeaders(["session.id", "", "participant.name"]), /cannot append safely:.*blank header cells/i);
assertThrowsWithMessage(() => getLiveAppendHeaders([...PSILABS_DOT_V1_HEADERS, "mystery.column"]), /cannot append safely:.*unknown columns/i);
assertThrowsWithMessage(() => buildReadableTrialRows(["session.id", "", "participant.name"], []), /cannot be read safely:.*blank header cells/i);

assert.equal(isSupabaseConfigured, false);
assert.equal(isCloudSaveAvailable(), false);
assert.equal(supabase, null);
assert.equal(getSupabaseClient(), null);

const cloudSummary = buildSessionSummaryFromSoloResults(sessionA, {
  googleSheetId: "sheet-test-id",
  archivedToGoogleSheet: true,
});
assert.equal(cloudSummary.local_session_id, sessionA.sessionId);
assert.equal(cloudSummary.protocol_phenomenon, "mindsight");
assert.equal(cloudSummary.protocol_type, "forced_choice_perception");
assert.equal(cloudSummary.target_type, "Colors");
assert.equal(cloudSummary.response_mode, GUESS_POLICIES.REPEAT_UNTIL_CORRECT);
assert.equal(cloudSummary.deck_policy, DECK_POLICIES.BALANCED_DECK);
assert.equal(cloudSummary.trial_count, sessionA.trials.length);
assert.equal(cloudSummary.archived_to_google_sheet, true);
assert.equal(cloudSummary.google_sheet_id, "sheet-test-id");

const disabledCloudSave = await saveSessionSummary(sessionA);
assert.equal(disabledCloudSave.ok, false);
assert.equal(disabledCloudSave.reason, "supabase_not_configured");
assert.equal(disabledCloudSave.error, null);

console.log("Data contract verification passed.");

# Current Tasks

Current actionable work for the next implementation pass. Completed work belongs in `ARCHIVED_TASKS.md`; future ideas belong in `ROADMAP.md`.

## Start Here Next

Continue the optional cloud layer wiring without changing Google Sheets or CSV archive behavior.

Supabase first-pass status:

- `@supabase/supabase-js` is declared in `package.json`.
- `src/lib/supabase.js` exports `supabase`, `isSupabaseConfigured`, and `getSupabaseClient()`.
- Missing `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` disables Supabase gracefully.
- `src/cloud/sessionSummaryCloud.js` can build and save lightweight solo session summaries, but save is a safe no-op when Supabase is unconfigured.
- `docs/SUPABASE_SCHEMA.md` documents the phase 1 schema.
- `supabase/migrations/001_initial_cloud_summary.sql` creates private-by-default summary tables with RLS.
- No full trial rows are stored in Supabase.
- Google Sheets remains the durable full trial archive; CSV export remains supported.

Next implementation target:

- Decide where, if anywhere, to call `saveSessionSummary()` in the UI flow.
- If wired, keep it optional and status-only. Do not block CSV export, Google Sheets append, or local-only sessions.
- Consider adding a tiny cloud status line only after the existing Google Sheets save path remains unchanged.

## Data Contract / Sheets Safety

Double-check the import, export, and append paths end to end before moving to larger roadmap work.

Last known state:

- CSV solo export uses the canonical dot v1 header order from `PSILABS_DOT_V1_HEADERS`.
- New Google Sheets exports use the same canonical dot v1 header order.
- Existing non-empty Google Sheets append by matching the live header row, so manually reordered columns should not corrupt future appends.
- CSV solo import accepts legacy v0 and dot v1 fields through the schema registry.
- Google Sheets history rebuild reads dot v1 fields with legacy fallback/backfill.

Local verification now exists:

- Run `npm run verify:data-contract`.
- The script verifies canonical CSV headers, solo CSV round-trip parsing, history CSV row counts, reusable sheet schema inspection statuses, blank-sheet append initialization, manually reordered append headers, non-mutating reordered/legacy history reads, blank header failures, and unknown header failures.

Next implementation target:

- Add the visible `Standardize Sheet Layout` confirmation/progress UX using `getTrialsSheetSchemaStatus()` and `standardizeTrialsSheetLayout()`.
- Show whether the sheet is already preferred dot v1 order, reordered but safe, legacy but safe, upgradeable, or blocked by missing required columns, unknown columns, blank header cells, duplicate field columns, or non-Mindsight protocol rows.

Important caution:

- History loading is now non-mutating: `readTrialsSheetRows()` reads recognized live headers and value rows without calling the physical migration path. Physical rewrite should stay behind explicit user confirmation.

## Google Sheets Schema Direction

Core principle:

- Separate logical schema compatibility from physical sheet layout.
- Normal read/append behavior cares whether the sheet is readable and append-safe by recognized headers, not whether the physical columns are in canonical dot-v1 order.

Default behavior:

- Read existing sheets without mutation.
- Recognize legacy Mindsight headers through aliases in the schema registry.
- Normalize and backfill in memory only.
- Append rows by matching the live header row names.
- Do not physically reorder columns during read/history/append.
- Do not prompt merely because columns are manually reordered.

Policy:

- Reordered canonical columns are user customization and remain append-safe.
- Prompt only for explicit optional actions such as `Standardize Sheet Layout`.
- Standardization may physically reorder/normalize the sheet into canonical PsiLabs dot-v1 column order while preserving recognized data.
- Block when safety is uncertain: blank header cells within the used header range, unknown headers, missing required recognized columns, duplicate recognized field columns, or non-Mindsight protocol rows during a Mindsight-only physical migration.

Recent UI clarification:

- Solo current run: `Download This Session`
- Solo selected Google history user: `Download Selected User History`
- Group all participants: `Download All Users Data`
- Group participant: `Download {participant.name}`

Future UI follow-up:

- Once all-users-across-Google-history export exists for solo history, add a separate `Download All Users History` button so it is distinct from selected-user and this-session exports.

## Project State

Solo-mode foundations are mostly in place:

- Canonical session/model helpers: `src/lib/sessionModel.js`
- Deck generation: `src/lib/deck.js`
- Analytics math: `src/lib/sessionAnalytics.js`
- Solo payload shaping: `src/lib/soloSessionPayload.js`
- Solo schema mapping: `src/lib/schemaRegistry.js`
- CSV row shape and dot-style exports: `src/lib/csv.js`
- Google Sheets append/read behavior: `src/lib/googleSheets.js`
- Historical Google Sheets rebuild/backfill behavior: `src/lib/googleSheetHistory.js`
- Local data-contract verification: `scripts/verify-data-contract.mjs`

Recently completed work has been moved to `ARCHIVED_TASKS.md`.

## Immediate Next Tasks

Do these one at a time.

### 1. Google Sheets Upgrade UX

- Add explicit Google Sheets schema upgrade confirmation and progress UX.
- Show what will change before physical sheet migration.
- Make failures clear when required columns are missing, unknown columns exist, or non-Mindsight protocol rows are present.

Acceptance criteria:

- Users must confirm before a live Google Sheet is physically migrated.
- Progress or status is visible during upgrade.
- Migration-blocking errors name the reason and preserve existing sheet data.

### 2. Live Google Sheets Verification

- Manually verify append/read behavior against a live Google Sheet.
- Include new dot v1 sheets, manually reordered dot v1 sheets, and recognized Mindsight v0/mixed sheets.
- Confirm history rebuild and backfill behavior.

Acceptance criteria:

- New sheet initializes with the approved canonical dot v1 header order.
- Existing recognized v0/mixed sheet reads as expected.
- Append writes by matching the live header row, not by assuming physical column position.
- Manual column reordering in Google Sheets does not corrupt future appends.
- History load succeeds.
- Estimated timing and time-of-day fields backfill for historical rows.

### 3. Manual Solo Mode Testing

Run manual testing across all solo mode combinations:

- `repeatUntilCorrect + balancedDeck`
- `repeatUntilCorrect + independentDraws`
- `oneShot + balancedDeck`
- `oneShot + independentDraws`

Acceptance criteria for each combination:

- Setup screen renders.
- Guess Policy appears.
- Deck Policy appears.
- Session starts.
- Results page loads.
- Mode badges are correct.
- Summary cards match mode.
- Z-score and p-value appear when valid.
- One-shot hides repeat-only metrics.
- Graph renders.
- CSV export succeeds.
- CSV import succeeds.
- Google Sheets append succeeds against canonical-order and manually reordered sheets.
- Google Sheets history load succeeds.
- Historical rows backfill estimated trial timestamps and time-of-day.

### 4. Multi-Run And Exit Protection Foundation

- Add exit protection for in-progress solo test phase.
- Introduce a `savedRuns` session structure when ready.
- Support redo/new run appending under one broader session.

Acceptance criteria:

- In-progress data is protected before leaving the test phase.
- Multiple completed trial blocks can be represented under one session.
- Results/export logic can distinguish latest run from all saved runs.

## Files Most Likely To Change Next

- `src/lib/csv.js`: schema headers, row values, CSV import/export.
- `src/lib/soloSessionPayload.js`: defaults for new session/trial fields.
- `src/lib/googleSheets.js`: optional/required header handling and upgrade UX integration.
- `src/lib/googleSheetHistory.js`: historical/default reconstruction.
- `src/lib/sessionModel.js`: canonical comments/constants if new enums are formalized.

## Manual Test Checklist

- [ ] Setup screen renders.
- [ ] Guess Policy appears.
- [ ] Deck Policy appears.
- [ ] Session starts.
- [ ] Results page loads.
- [ ] Mode badges are correct.
- [ ] Summary cards match mode.
- [ ] Z-score and p-value appear when valid.
- [ ] One-shot hides repeat-only metrics.
- [ ] Graph renders.
- [ ] CSV export succeeds.
- [ ] CSV import succeeds.
- [ ] Google Sheets append succeeds.
- [ ] Google Sheets history load succeeds.
- [ ] Historical rows backfill estimated trial timestamps/time-of-day.

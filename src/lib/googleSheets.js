import { buildDotV1SoloTrialRowObjects } from "./csv.js";
import {
  PSILABS_DOT_V1_HEADERS,
  analyzeSoloHeaders,
  backfillSoloRows,
  convertNormalizedSoloRowToLegacy,
  denormalizeSoloRow,
  normalizeSoloRow,
} from "./schemaRegistry.js";

export const TRIALS_SHEET_TITLE = "Trials";
const MIGRATABLE_PROTOCOL_PHENOMENA = new Set(["", "mindsight"]);

function formatHeaderList(headers) {
  return headers.join(", ");
}

async function fetchGoogleSheetsJson(url, accessToken, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    let errorMessage = "Google Sheets request failed.";

    try {
      const errorPayload = await response.json();
      errorMessage = errorPayload?.error?.message || errorMessage;
    } catch (error) {
      // Keep fallback message.
    }

    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export async function createMindsightSpreadsheet(accessToken) {
  if (!accessToken) {
    throw new Error("Connect Google before creating a Mindsight sheet.");
  }

  const spreadsheet = await fetchGoogleSheetsJson("https://sheets.googleapis.com/v4/spreadsheets", accessToken, {
    method: "POST",
    body: JSON.stringify({
      properties: {
        title: `Mindsight Trials ${new Date().toISOString().slice(0, 10)}`,
      },
      sheets: [
        { properties: { title: TRIALS_SHEET_TITLE } },
      ],
    }),
  });

  return {
    spreadsheetId: spreadsheet.spreadsheetId,
    spreadsheetUrl: spreadsheet.spreadsheetUrl,
    title: spreadsheet.properties?.title || "Mindsight Trials",
  };
}

async function getSpreadsheetMetadata(accessToken, spreadsheetId) {
  return fetchGoogleSheetsJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,spreadsheetUrl,sheets.properties.title`,
    accessToken
  );
}

async function ensureTrialsSheetExists(accessToken, spreadsheetId) {
  const metadata = await getSpreadsheetMetadata(accessToken, spreadsheetId);
  const hasTrialsSheet = metadata.sheets?.some((sheet) => sheet.properties?.title === TRIALS_SHEET_TITLE);

  if (!hasTrialsSheet) {
    await fetchGoogleSheetsJson(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      accessToken,
      {
        method: "POST",
        body: JSON.stringify({
          requests: [
            {
              addSheet: {
                properties: {
                  title: TRIALS_SHEET_TITLE,
                },
              },
            },
          ],
        }),
      }
    );
  }

  return metadata;
}

async function getTrialsSheetHeaderRow(accessToken, spreadsheetId) {
  const result = await fetchGoogleSheetsJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`${TRIALS_SHEET_TITLE}!1:1`)}`,
    accessToken
  );

  return result?.values?.[0] ?? [];
}

export function inspectTrialsSheetSchema(existingHeaders, options = {}) {
  const { normalizedRows = null, requireMigratableProtocols = false } = options;
  const headers = existingHeaders.map((header) => String(header || "").trim());
  const hasHeaders = headers.some(Boolean);
  const blankHeaders = hasHeaders
    ? headers
        .map((header, index) => header ? null : index + 1)
        .filter((columnNumber) => columnNumber != null)
    : [];
  const nonBlankHeaders = headers.filter(Boolean);
  const headerAnalysis = analyzeSoloHeaders(nonBlankHeaders);
  const recognizedHeaders = headerAnalysis.recognizedHeaders;
  const duplicateCanonicalFields = recognizedHeaders.filter((field, index, fields) => {
    return fields.indexOf(field) !== index;
  });
  const nonMigratableProtocolRows = requireMigratableProtocols && Array.isArray(normalizedRows)
    ? normalizedRows.filter((row) => {
        return !MIGRATABLE_PROTOCOL_PHENOMENA.has(String(row["protocol.phenomenon"] || "").trim().toLowerCase());
      })
    : [];
  const canonicalOrder = hasHeaders && headerAnalysis.isPreferredOrder;
  const legacyButSafe = hasHeaders && headerAnalysis.usesLegacyAliases && blankHeaders.length === 0 && headerAnalysis.missingRequiredHeaders.length === 0 && headerAnalysis.unknownHeaders.length === 0 && duplicateCanonicalFields.length === 0;
  const reorderedButSafe = hasHeaders && !canonicalOrder && !legacyButSafe && headerAnalysis.usesCanonicalHeaders && blankHeaders.length === 0 && headerAnalysis.missingRequiredHeaders.length === 0 && headerAnalysis.unknownHeaders.length === 0 && duplicateCanonicalFields.length === 0;
  const blockReasons = [];

  if (blankHeaders.length > 0) {
    blockReasons.push(`Blank header cells in columns: ${blankHeaders.join(", ")}`);
  }

  if (headerAnalysis.unknownHeaders.length > 0) {
    blockReasons.push(`Unknown columns: ${formatHeaderList(headerAnalysis.unknownHeaders)}`);
  }

  if (headerAnalysis.missingRequiredHeaders.length > 0) {
    blockReasons.push(`Missing required columns: ${formatHeaderList(headerAnalysis.missingRequiredHeaders)}`);
  }

  if (duplicateCanonicalFields.length > 0) {
    blockReasons.push(`Duplicate columns for fields: ${formatHeaderList([...new Set(duplicateCanonicalFields)])}`);
  }

  if (nonMigratableProtocolRows.length > 0) {
    blockReasons.push("Sheet contains non-Mindsight protocol rows.");
  }

  const blocked = blockReasons.length > 0;
  const compatible = hasHeaders && !blocked;

  return {
    compatible,
    canonicalOrder,
    reorderedButSafe,
    legacyButSafe,
    upgradeAvailable: compatible && !canonicalOrder,
    blocked,
    blockReasons,
    recognizedHeaders,
    unknownHeaders: headerAnalysis.unknownHeaders,
    blankHeaders,
    missingRequired: headerAnalysis.missingRequiredHeaders,
    duplicateCanonicalFields: [...new Set(duplicateCanonicalFields)],
    hasHeaders,
    headers,
    schemaId: headerAnalysis.schemaId,
    usesLegacyAliases: headerAnalysis.usesLegacyAliases,
    usesCanonicalHeaders: headerAnalysis.usesCanonicalHeaders,
  };
}

function assertTrialsSheetCompatible(existingHeaders, actionLabel) {
  const inspection = inspectTrialsSheetSchema(existingHeaders);

  if (!inspection.hasHeaders) {
    return inspection;
  }

  if (inspection.blocked) {
    throw new Error(`Trials sheet cannot ${actionLabel}: ${inspection.blockReasons.join("; ")}`);
  }

  return inspection;
}

export function getLiveAppendHeaders(existingHeaders) {
  const headers = existingHeaders.map((header) => String(header || "").trim());

  if (headers.every((header) => !header)) {
    return {
      shouldInitialize: true,
      headers: PSILABS_DOT_V1_HEADERS,
    };
  }

  assertTrialsSheetCompatible(headers, "append safely");

  return {
    shouldInitialize: false,
    headers,
  };
}

function mapRowsToObjects(headers, rows) {
  return rows.map((rowValues) =>
    Object.fromEntries(headers.map((header, index) => [header, rowValues[index] ?? ""]))
  );
}

export function buildReadableTrialRows(existingHeaders, valueRows) {
  const inspection = assertTrialsSheetCompatible(existingHeaders, "be read safely");

  if (!inspection.hasHeaders) {
    return [];
  }

  const headers = inspection.headers;
  const rowObjects = mapRowsToObjects(headers, valueRows);
  const normalizedRows = backfillSoloRows(rowObjects);

  return rowObjects.map((rowObject, index) => {
    const normalizedRow = normalizedRows[index] || normalizeSoloRow(rowObject);
    return { ...rowObject, ...convertNormalizedSoloRowToLegacy(normalizedRow) };
  });
}

async function clearTrialsSheetValues(accessToken, spreadsheetId) {
  await fetchGoogleSheetsJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`${TRIALS_SHEET_TITLE}!A1:ZZ`)}:clear`,
    accessToken,
    {
      method: "POST",
    }
  );
}

async function writeTrialsSheetValues(accessToken, spreadsheetId, values) {
  await fetchGoogleSheetsJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`${TRIALS_SHEET_TITLE}!A1`)}?valueInputOption=RAW`,
    accessToken,
    {
      method: "PUT",
      body: JSON.stringify({ values }),
    }
  );
}

async function readTrialsSheetValueRows(accessToken, spreadsheetId) {
  const result = await fetchGoogleSheetsJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`${TRIALS_SHEET_TITLE}!A2:ZZ`)}`,
    accessToken
  );

  return result?.values ?? [];
}

async function migrateTrialsSheetToDotV1(accessToken, spreadsheetId, existingHeaders) {
  const normalizedHeaders = existingHeaders.map((header) => String(header || "").trim()).filter(Boolean);
  const preflightInspection = assertTrialsSheetCompatible(existingHeaders, "be standardized");

  if (preflightInspection.canonicalOrder) {
    return PSILABS_DOT_V1_HEADERS;
  }

  const rows = await readTrialsSheetValueRows(accessToken, spreadsheetId);
  const rowObjects = mapRowsToObjects(normalizedHeaders, rows);
  const normalizedRows = backfillSoloRows(rowObjects);
  const migrationInspection = inspectTrialsSheetSchema(existingHeaders, {
    normalizedRows,
    requireMigratableProtocols: true,
  });

  if (migrationInspection.blocked) {
    throw new Error(`Trials sheet cannot be standardized: ${migrationInspection.blockReasons.join("; ")}`);
  }

  const migratedRows = normalizedRows.map((row) => denormalizeSoloRow(row, PSILABS_DOT_V1_HEADERS));

  await clearTrialsSheetValues(accessToken, spreadsheetId);
  await writeTrialsSheetValues(accessToken, spreadsheetId, [PSILABS_DOT_V1_HEADERS, ...migratedRows]);

  return PSILABS_DOT_V1_HEADERS;
}

export async function getTrialsSheetSchemaStatus(accessToken, spreadsheetId) {
  if (!accessToken) {
    throw new Error("Connect Google before checking the Trials sheet schema.");
  }

  if (!spreadsheetId) {
    throw new Error("Choose or create a Mindsight sheet before checking the schema.");
  }

  await ensureTrialsSheetExists(accessToken, spreadsheetId);
  const existingHeaders = await getTrialsSheetHeaderRow(accessToken, spreadsheetId);
  return inspectTrialsSheetSchema(existingHeaders);
}

export async function standardizeTrialsSheetLayout(accessToken, spreadsheetId) {
  if (!accessToken) {
    throw new Error("Connect Google before standardizing the Trials sheet.");
  }

  if (!spreadsheetId) {
    throw new Error("Choose or create a Mindsight sheet before standardizing the schema.");
  }

  await ensureTrialsSheetExists(accessToken, spreadsheetId);
  const existingHeaders = await getTrialsSheetHeaderRow(accessToken, spreadsheetId);
  const headers = await migrateTrialsSheetToDotV1(accessToken, spreadsheetId, existingHeaders);

  return {
    headers,
    standardized: true,
  };
}

function buildAppendRowsForHeaders(sessionData, headers) {
  return buildDotV1SoloTrialRowObjects(sessionData).map((rowObject) => {
    return denormalizeSoloRow(rowObject, headers);
  });
}

export async function appendSoloTrials(accessToken, spreadsheetId, sessionData) {
  if (!accessToken) {
    throw new Error("Connect Google before appending trials.");
  }

  if (!spreadsheetId) {
    throw new Error("Choose or create a Mindsight sheet before appending trials.");
  }

  await ensureTrialsSheetExists(accessToken, spreadsheetId);
  const existingHeaders = await getTrialsSheetHeaderRow(accessToken, spreadsheetId);
  const appendTarget = getLiveAppendHeaders(existingHeaders);

  if (appendTarget.shouldInitialize) {
    await writeTrialsSheetValues(accessToken, spreadsheetId, [PSILABS_DOT_V1_HEADERS]);
  }

  const trialRows = buildAppendRowsForHeaders(sessionData, appendTarget.headers);
  if (trialRows.length === 0) {
    return { appendedRowCount: 0 };
  }

  await fetchGoogleSheetsJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`${TRIALS_SHEET_TITLE}!A1`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    accessToken,
    {
      method: "POST",
      body: JSON.stringify({
        values: trialRows,
      }),
    }
  );

  return {
    appendedRowCount: trialRows.length,
  };
}

export async function readTrialsSheetRows(accessToken, spreadsheetId) {
  if (!accessToken) {
    throw new Error("Connect Google before reading trials.");
  }

  if (!spreadsheetId) {
    throw new Error("Choose or create a Mindsight sheet before reading trials.");
  }

  await ensureTrialsSheetExists(accessToken, spreadsheetId);
  const existingHeaders = await getTrialsSheetHeaderRow(accessToken, spreadsheetId);
  const rows = await readTrialsSheetValueRows(accessToken, spreadsheetId);
  return buildReadableTrialRows(existingHeaders, rows);
}

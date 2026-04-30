const GOOGLE_SHEET_STORAGE_KEY = "mindsight.googleSheetSession";
const SHEET_ID_STORAGE_KEY = "sheetId";
const SELECTED_SHEET_STORAGE_KEY = "selectedSheet";

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function normalizeAccountKey(accountKey = "") {
  return String(accountKey || "").trim().toLowerCase();
}

function getGoogleSheetStorageKey(accountKey = "") {
  const normalizedAccountKey = normalizeAccountKey(accountKey);
  return normalizedAccountKey
    ? `${GOOGLE_SHEET_STORAGE_KEY}.${normalizedAccountKey}`
    : GOOGLE_SHEET_STORAGE_KEY;
}

export function getEmptyGoogleSheetState(error = "") {
  return {
    status: "idle",
    spreadsheetId: "",
    spreadsheetUrl: "",
    spreadsheetName: "",
    title: "",
    error,
  };
}

function normalizeSelectedSheet(value) {
  const spreadsheetId = String(value?.spreadsheetId || value?.sheetId || "").trim();
  if (!spreadsheetId) {
    return null;
  }

  const spreadsheetName = value?.spreadsheetName || value?.title || value?.name || "Mindsight Trials";
  const spreadsheetUrl = value?.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  return {
    ...getEmptyGoogleSheetState(),
    status: "selected",
    spreadsheetId,
    spreadsheetUrl,
    spreadsheetName,
    title: spreadsheetName,
    error: "",
  };
}

export function restoreGoogleSheetSession(accountKey = "") {
  if (!isBrowser()) {
    return getEmptyGoogleSheetState();
  }

  try {
    const storedSelectedSheet = window.localStorage.getItem(SELECTED_SHEET_STORAGE_KEY);
    if (storedSelectedSheet) {
      const selectedSheet = normalizeSelectedSheet(JSON.parse(storedSelectedSheet));
      if (selectedSheet) {
        return selectedSheet;
      }
    }

    const storedSheetId = window.localStorage.getItem(SHEET_ID_STORAGE_KEY);
    if (storedSheetId) {
      const selectedSheet = normalizeSelectedSheet({ spreadsheetId: storedSheetId });
      if (selectedSheet) {
        return selectedSheet;
      }
    }

    const storedValue = window.localStorage.getItem(getGoogleSheetStorageKey(accountKey));
    if (!storedValue) {
      return getEmptyGoogleSheetState();
    }

    const parsedValue = JSON.parse(storedValue);
    if (!parsedValue?.spreadsheetId || !parsedValue?.spreadsheetUrl) {
      clearGoogleSheetSession(accountKey);
      return getEmptyGoogleSheetState();
    }

    return normalizeSelectedSheet(parsedValue) || getEmptyGoogleSheetState();
  } catch (error) {
    clearGoogleSheetSession(accountKey);
    return getEmptyGoogleSheetState();
  }
}

export function persistGoogleSheetSession(googleSheet, accountKey = "") {
  if (!isBrowser()) {
    return;
  }

  const selectedSheet = normalizeSelectedSheet(googleSheet);
  if (!selectedSheet) {
    return;
  }

  window.localStorage.setItem(
    getGoogleSheetStorageKey(accountKey),
    JSON.stringify({
      spreadsheetId: selectedSheet.spreadsheetId,
      spreadsheetUrl: selectedSheet.spreadsheetUrl,
      spreadsheetName: selectedSheet.spreadsheetName,
      title: selectedSheet.title,
      status: "selected",
    })
  );
  window.localStorage.setItem(
    SELECTED_SHEET_STORAGE_KEY,
    JSON.stringify({
      spreadsheetId: selectedSheet.spreadsheetId,
      spreadsheetUrl: selectedSheet.spreadsheetUrl,
      spreadsheetName: selectedSheet.spreadsheetName,
      title: selectedSheet.title,
      status: "selected",
    })
  );
  window.localStorage.setItem(SHEET_ID_STORAGE_KEY, selectedSheet.spreadsheetId);
}

export function clearGoogleSheetSession(accountKey = "") {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.removeItem(getGoogleSheetStorageKey(accountKey));
  window.localStorage.removeItem(SELECTED_SHEET_STORAGE_KEY);
  window.localStorage.removeItem(SHEET_ID_STORAGE_KEY);
}

const GOOGLE_SHEET_STORAGE_KEY = "mindsight.googleSheetSession";

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
    title: "",
    error,
  };
}

export function restoreGoogleSheetSession(accountKey = "") {
  if (!isBrowser()) {
    return getEmptyGoogleSheetState();
  }

  try {
    const storedValue = window.localStorage.getItem(getGoogleSheetStorageKey(accountKey));
    if (!storedValue) {
      return getEmptyGoogleSheetState();
    }

    const parsedValue = JSON.parse(storedValue);
    if (!parsedValue?.spreadsheetId || !parsedValue?.spreadsheetUrl) {
      clearGoogleSheetSession(accountKey);
      return getEmptyGoogleSheetState();
    }

    return {
      ...getEmptyGoogleSheetState(),
      ...parsedValue,
      status: "selected",
      error: "",
    };
  } catch (error) {
    clearGoogleSheetSession(accountKey);
    return getEmptyGoogleSheetState();
  }
}

export function persistGoogleSheetSession(googleSheet, accountKey = "") {
  if (!isBrowser()) {
    return;
  }

  if (!googleSheet?.spreadsheetId || !googleSheet?.spreadsheetUrl) {
    clearGoogleSheetSession(accountKey);
    return;
  }

  window.localStorage.setItem(
    getGoogleSheetStorageKey(accountKey),
    JSON.stringify({
      spreadsheetId: googleSheet.spreadsheetId,
      spreadsheetUrl: googleSheet.spreadsheetUrl,
      title: googleSheet.title || "Mindsight Trials",
    })
  );
}

export function clearGoogleSheetSession(accountKey = "") {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.removeItem(getGoogleSheetStorageKey(accountKey));
}

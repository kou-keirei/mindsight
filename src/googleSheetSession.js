const GOOGLE_SHEET_STORAGE_KEY = "mindsight.googleSheetSession";

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
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

export function restoreGoogleSheetSession() {
  if (!isBrowser()) {
    return getEmptyGoogleSheetState();
  }

  try {
    const storedValue = window.localStorage.getItem(GOOGLE_SHEET_STORAGE_KEY);
    if (!storedValue) {
      return getEmptyGoogleSheetState();
    }

    const parsedValue = JSON.parse(storedValue);
    if (!parsedValue?.spreadsheetId || !parsedValue?.spreadsheetUrl) {
      clearGoogleSheetSession();
      return getEmptyGoogleSheetState();
    }

    return {
      ...getEmptyGoogleSheetState(),
      ...parsedValue,
      status: "selected",
      error: "",
    };
  } catch (error) {
    clearGoogleSheetSession();
    return getEmptyGoogleSheetState();
  }
}

export function persistGoogleSheetSession(googleSheet) {
  if (!isBrowser()) {
    return;
  }

  if (!googleSheet?.spreadsheetId || !googleSheet?.spreadsheetUrl) {
    clearGoogleSheetSession();
    return;
  }

  window.localStorage.setItem(
    GOOGLE_SHEET_STORAGE_KEY,
    JSON.stringify({
      spreadsheetId: googleSheet.spreadsheetId,
      spreadsheetUrl: googleSheet.spreadsheetUrl,
      title: googleSheet.title || "Mindsight Trials",
    })
  );
}

export function clearGoogleSheetSession() {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.removeItem(GOOGLE_SHEET_STORAGE_KEY);
}

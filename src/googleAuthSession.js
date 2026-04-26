const GOOGLE_AUTH_STORAGE_KEY = "mindsight.googleAuthSession";
const EXPIRY_SKEW_MS = 60 * 1000;

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getEmptyGoogleAuthState(error = "") {
  return {
    status: error ? "error" : "idle",
    accessToken: "",
    issuedAt: "",
    expiresIn: 0,
    scope: "",
    tokenType: "",
    accountId: "",
    accountEmail: "",
    error,
  };
}

export function isGoogleAuthSessionUsable(googleAuth) {
  if (!googleAuth?.accessToken || !googleAuth?.issuedAt || !googleAuth?.expiresIn) {
    return false;
  }

  const issuedAtMs = Date.parse(googleAuth.issuedAt);
  if (Number.isNaN(issuedAtMs)) {
    return false;
  }

  const expiresAtMs = issuedAtMs + (Number(googleAuth.expiresIn) * 1000);
  return expiresAtMs - EXPIRY_SKEW_MS > Date.now();
}

export function restoreGoogleAuthSession() {
  if (!isBrowser()) {
    return getEmptyGoogleAuthState();
  }

  try {
    const storedValue = window.localStorage.getItem(GOOGLE_AUTH_STORAGE_KEY);
    if (!storedValue) {
      return getEmptyGoogleAuthState();
    }

    const parsedValue = JSON.parse(storedValue);
    if (!isGoogleAuthSessionUsable(parsedValue)) {
      clearGoogleAuthSession();
      return getEmptyGoogleAuthState();
    }

    return {
      ...getEmptyGoogleAuthState(),
      ...parsedValue,
      status: "connected",
      error: "",
    };
  } catch (error) {
    clearGoogleAuthSession();
    return getEmptyGoogleAuthState();
  }
}

export function persistGoogleAuthSession(googleAuth) {
  if (!isBrowser()) {
    return;
  }

  if (!isGoogleAuthSessionUsable(googleAuth)) {
    clearGoogleAuthSession();
    return;
  }

  const persistedValue = {
    accessToken: googleAuth.accessToken,
    issuedAt: googleAuth.issuedAt,
    expiresIn: googleAuth.expiresIn,
    scope: googleAuth.scope,
    tokenType: googleAuth.tokenType,
    accountId: googleAuth.accountId || "",
    accountEmail: googleAuth.accountEmail || "",
  };

  window.localStorage.setItem(GOOGLE_AUTH_STORAGE_KEY, JSON.stringify(persistedValue));
}

export function clearGoogleAuthSession() {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.removeItem(GOOGLE_AUTH_STORAGE_KEY);
}

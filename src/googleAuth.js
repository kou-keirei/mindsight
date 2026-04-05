const GOOGLE_IDENTITY_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const GOOGLE_SHEETS_SCOPE = "https://www.googleapis.com/auth/drive.file";

let googleScriptPromise = null;

function getGoogleClientId() {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
}

function getGoogleSheetsScope() {
  const customScope = import.meta.env.VITE_GOOGLE_SHEETS_SCOPE;
  return customScope || GOOGLE_SHEETS_SCOPE;
}

export function isGoogleAuthConfigured() {
  return Boolean(getGoogleClientId());
}

export function loadGoogleIdentityScript() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google sign-in is only available in the browser."));
  }

  if (window.google?.accounts?.oauth2) {
    return Promise.resolve(window.google);
  }

  if (googleScriptPromise) {
    return googleScriptPromise;
  }

  googleScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector(`script[src="${GOOGLE_IDENTITY_SCRIPT_SRC}"]`);
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(window.google), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Unable to load Google's sign-in script.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = GOOGLE_IDENTITY_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google);
    script.onerror = () => reject(new Error("Unable to load Google's sign-in script."));
    document.head.appendChild(script);
  });

  return googleScriptPromise;
}

export async function requestGoogleAccessToken() {
  const clientId = getGoogleClientId();
  if (!clientId) {
    throw new Error("Google sign-in is not configured. Add VITE_GOOGLE_CLIENT_ID to your environment.");
  }

  const google = await loadGoogleIdentityScript();

  return new Promise((resolve, reject) => {
    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: getGoogleSheetsScope(),
      callback: (response) => {
        if (response?.error) {
          reject(new Error(response.error));
          return;
        }

        resolve({
          accessToken: response.access_token,
          expiresIn: response.expires_in,
          scope: response.scope,
          tokenType: response.token_type,
          issuedAt: new Date().toISOString(),
        });
      },
      error_callback: (error) => {
        reject(new Error(error?.message || "Google sign-in was cancelled or blocked."));
      },
    });

    tokenClient.requestAccessToken({ prompt: "consent" });
  });
}

export async function revokeGoogleAccessToken(accessToken) {
  if (!accessToken) {
    return;
  }

  const google = await loadGoogleIdentityScript();

  await new Promise((resolve) => {
    google.accounts.oauth2.revoke(accessToken, () => resolve());
  });
}

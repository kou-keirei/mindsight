const GOOGLE_PICKER_SCRIPT_SRC = "https://apis.google.com/js/api.js";

let pickerScriptPromise = null;

function getGoogleApiKey() {
  return import.meta.env.VITE_GOOGLE_API_KEY || "";
}

function getGoogleCloudAppId() {
  return import.meta.env.VITE_GOOGLE_CLOUD_APP_ID || "";
}

export function isGooglePickerConfigured() {
  return Boolean(getGoogleApiKey() && getGoogleCloudAppId());
}

export function loadGooglePickerScript() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Picker is only available in the browser."));
  }

  if (window.google?.picker) {
    return Promise.resolve(window.google);
  }

  if (pickerScriptPromise) {
    return pickerScriptPromise;
  }

  pickerScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector(`script[src="${GOOGLE_PICKER_SCRIPT_SRC}"]`);

    const initializePickerApi = () => {
      window.gapi.load("picker", {
        callback: () => resolve(window.google),
        onerror: () => reject(new Error("Unable to load the Google Picker API.")),
      });
    };

    if (existingScript) {
      if (window.gapi?.load) {
        initializePickerApi();
        return;
      }

      existingScript.addEventListener("load", initializePickerApi, { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Unable to load the Google Picker API.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = GOOGLE_PICKER_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = initializePickerApi;
    script.onerror = () => reject(new Error("Unable to load the Google Picker API."));
    document.head.appendChild(script);
  });

  return pickerScriptPromise;
}

export async function pickExistingSpreadsheet(accessToken) {
  if (!accessToken) {
    throw new Error("Connect Google before choosing an existing sheet.");
  }

  if (!isGooglePickerConfigured()) {
    throw new Error("Add VITE_GOOGLE_API_KEY and VITE_GOOGLE_CLOUD_APP_ID before enabling sheet selection.");
  }

  const google = await loadGooglePickerScript();

  return new Promise((resolve, reject) => {
    const spreadsheetView = new google.picker.DocsView(google.picker.ViewId.SPREADSHEETS)
      .setIncludeFolders(false)
      .setSelectFolderEnabled(false);

    const picker = new google.picker.PickerBuilder()
      .setOAuthToken(accessToken)
      .setDeveloperKey(getGoogleApiKey())
      .setAppId(getGoogleCloudAppId())
      .addView(spreadsheetView)
      .setTitle("Choose a Mindsight spreadsheet")
      .setCallback((data) => {
        if (data.action === google.picker.Action.CANCEL) {
          reject(new Error("Sheet selection was cancelled."));
          return;
        }

        if (data.action !== google.picker.Action.PICKED) {
          return;
        }

        const pickedDocument = data.docs?.[0];
        if (!pickedDocument?.id) {
          reject(new Error("The selected spreadsheet did not include an ID."));
          return;
        }

        resolve({
          spreadsheetId: pickedDocument.id,
          spreadsheetUrl: pickedDocument.url || `https://docs.google.com/spreadsheets/d/${pickedDocument.id}/edit`,
          title: pickedDocument.name || "Selected Mindsight Sheet",
        });
      })
      .build();

    picker.setVisible(true);
  });
}

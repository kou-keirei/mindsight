export function createCallbackSet() {
  const callbacks = new Set();

  return {
    add(callback) {
      if (typeof callback !== "function") {
        return () => {};
      }

      callbacks.add(callback);
      return () => callbacks.delete(callback);
    },
    emit(payload) {
      callbacks.forEach((callback) => callback(payload));
    },
  };
}

export function hasWebAudioInput() {
  if (typeof window === "undefined") {
    return false;
  }

  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  return Boolean(AudioContextCtor && navigator.mediaDevices?.getUserMedia);
}

export function getBaseUrl() {
  return import.meta.env.BASE_URL || "/";
}

export function joinUrl(baseUrl, path) {
  if (!baseUrl) {
    return path;
  }

  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const normalizedPath = String(path ?? "").replace(/^\/+/, "");
  return `${normalizedBase}${normalizedPath}`;
}

export function getPerformanceNow() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

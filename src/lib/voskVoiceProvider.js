import { DEFAULT_PREBUFFER_OPTIONS, createWebAudioPrebuffer } from "./audioPrebuffer.js";
import { createCallbackSet, getBaseUrl, getPerformanceNow, hasWebAudioInput, joinUrl } from "./voiceProviderUtils.js";

const TARGET_COMMANDS = [
  "red",
  "blue",
  "a",
  "d",
  "space",
  "submit",
  "calibration",
  "test",
  "results",
];

const DEFAULT_MODEL_PATH = "models/vosk/model.tar.gz";
const DEFAULT_GRAMMAR = JSON.stringify([...TARGET_COMMANDS, "[unk]"]);

function getVoskModelUrl(options = {}) {
  return (
    options.modelUrl ||
    import.meta.env.VITE_VOSK_MODEL_URL ||
    joinUrl(getBaseUrl(), DEFAULT_MODEL_PATH)
  );
}

function toRecognizerText(message) {
  const result = message?.result ?? {};
  return String(result.text ?? result.partial ?? "").trim();
}

function getRecognizerConfidence(message) {
  const result = message?.result ?? {};
  if (typeof result.confidence === "number") {
    return result.confidence;
  }

  if (Array.isArray(result.result) && result.result.length > 0) {
    const total = result.result.reduce((sum, word) => sum + (word.conf ?? 0), 0);
    return total / result.result.length;
  }

  return null;
}

export function createVoskLocalProvider(options = {}) {
  const resultCallbacks = createCallbackSet();
  const errorCallbacks = createCallbackSet();
  const stateCallbacks = createCallbackSet();
  const sampleRate = options.sampleRate ?? DEFAULT_PREBUFFER_OPTIONS.sampleRate;
  const modelUrl = getVoskModelUrl(options);
  const grammar = options.grammar ?? DEFAULT_GRAMMAR;

  let audioInput = null;
  let model = null;
  let recognizer = null;
  let starting = false;
  let listening = false;
  let lastAudioAt = 0;

  const emitError = (error) => {
    const normalizedError = error instanceof Error ? error : new Error(String(error));
    stateCallbacks.emit("error");
    errorCallbacks.emit(normalizedError);
  };

  const emitResult = (message) => {
    const transcript = toRecognizerText(message);
    if (!transcript) {
      return;
    }

    const now = getPerformanceNow();
    resultCallbacks.emit({
      transcript,
      confidence: getRecognizerConfidence(message),
      providerName: "voskLocal",
      raw: message,
      latencyMs: lastAudioAt ? Math.max(0, Math.round(now - lastAudioAt)) : null,
    });
  };

  const startAsync = async () => {
    if (listening || starting) {
      return;
    }

    starting = true;
    stateCallbacks.emit("loading");

    try {
      if (!hasWebAudioInput()) {
        throw new Error("Vosk Local needs Web Audio microphone access in this browser.");
      }

      const vosk = await import("vosk-browser");
      const createModel = vosk.createModel ?? vosk.default?.createModel;
      if (typeof createModel !== "function") {
        throw new Error("vosk-browser did not expose createModel().");
      }

      model = await createModel(modelUrl, options.logLevel ?? -1);
      recognizer = new model.KaldiRecognizer(sampleRate, grammar);
      recognizer.setWords(Boolean(options.words));
      recognizer.on("result", emitResult);
      recognizer.on("error", (message) => emitError(message?.error || "Vosk recognizer error."));

      audioInput = createWebAudioPrebuffer({
        ...(options.prebuffer ?? DEFAULT_PREBUFFER_OPTIONS),
        sampleRate,
        onAudio(samples) {
          if (!recognizer) {
            return;
          }

          try {
            lastAudioAt = getPerformanceNow();
            recognizer.acceptWaveformFloat(samples, sampleRate);
          } catch (error) {
            emitError(error);
          }
        },
      });

      await audioInput.start();
      listening = true;
      stateCallbacks.emit("listening");
    } catch (error) {
      await stopAsync();
      emitError(error);
    } finally {
      starting = false;
    }
  };

  const stopAsync = async () => {
    listening = false;
    await audioInput?.stop?.();
    audioInput = null;

    try {
      recognizer?.retrieveFinalResult?.();
    } catch {
      // Ignore final-result races while tearing down the worker.
    }

    try {
      recognizer?.remove?.();
    } catch {
      // Ignore worker teardown races.
    }

    recognizer = null;

    try {
      model?.terminate?.();
    } catch {
      // Ignore worker teardown races.
    }

    model = null;
    stateCallbacks.emit("stopped");
  };

  return {
    providerName: "voskLocal",
    modelUrl,
    targetCommands: TARGET_COMMANDS,
    isAvailable: hasWebAudioInput,
    isSupported: hasWebAudioInput,
    start() {
      void startAsync();
    },
    stop() {
      void stopAsync();
    },
    cleanup() {
      void stopAsync();
    },
    onResult(callback) {
      return resultCallbacks.add(callback);
    },
    onError(callback) {
      return errorCallbacks.add(callback);
    },
    onStateChange(callback) {
      return stateCallbacks.add(callback);
    },
  };
}

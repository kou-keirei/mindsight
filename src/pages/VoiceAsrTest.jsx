import { useEffect, useMemo, useRef, useState } from "react";
import { VOICE_PROVIDER_OPTIONS, createVoiceProvider } from "../lib/voiceProviders.js";

const TEST_PROVIDER_IDS = ["browserSpeech", "voskLocal", "sherpaOnnxLocal"];
const TARGET_COMMANDS = [
  "red",
  "blue",
  "press A",
  "press D",
  "space",
  "submit",
  "calibration",
  "test",
  "results",
];

function normalizeText(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTestCommand(transcript) {
  const normalized = normalizeText(transcript);
  if (!normalized) return "";

  const tokens = normalized.split(" ");
  const hasWord = (word) => tokens.includes(word);

  if (hasWord("red")) return "red";
  if (hasWord("blue")) return "blue";
  if (normalized === "a" || normalized === "press a" || normalized === "button a") return "A";
  if (normalized === "d" || normalized === "press d" || normalized === "button d") return "D";
  if (hasWord("space")) return "space";
  if (hasWord("submit")) return "submit";
  if (hasWord("calibration")) return "calibration";
  if (hasWord("test")) return "test";
  if (hasWord("results")) return "results";

  return "";
}

function formatValue(value) {
  if (value == null || value === "") {
    return "none";
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(Math.round(value * 1000) / 1000) : "none";
  }

  return String(value);
}

function getProviderDiagnostics(providerId) {
  const provider = createVoiceProvider(providerId);
  const isAvailable = (provider.isAvailable?.() ?? provider.isSupported?.()) || false;
  const diagnostics = {
    providerName: provider.providerName,
    availability: isAvailable ? "available" : "unavailable",
  };

  provider.cleanup?.();
  return diagnostics;
}

function Detail({ label, value, tone = "neutral" }) {
  const color = tone === "bad" ? "#fca5a5" : tone === "good" ? "#86efac" : "#d8d4ee";

  return (
    <div style={{ display: "grid", gap: "4px", minWidth: 0 }}>
      <span style={{ color: "#8f89ad", fontSize: "0.72rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>
        {label}
      </span>
      <span style={{ color, fontSize: "0.96rem", overflowWrap: "anywhere" }}>{formatValue(value)}</span>
    </div>
  );
}

export function VoiceAsrTest() {
  const localAsrEnabled = import.meta.env.DEV || import.meta.env.VITE_ENABLE_LOCAL_ASR === "true";
  const providerOptions = useMemo(
    () => VOICE_PROVIDER_OPTIONS.filter((option) => TEST_PROVIDER_IDS.includes(option.id)),
    []
  );
  const [providerId, setProviderId] = useState("browserSpeech");
  const [providerName, setProviderName] = useState(() => getProviderDiagnostics("browserSpeech").providerName);
  const [availability, setAvailability] = useState(() => getProviderDiagnostics("browserSpeech").availability);
  const [modelLoadStatus, setModelLoadStatus] = useState("idle");
  const [listeningStatus, setListeningStatus] = useState("stopped");
  const [rawTranscript, setRawTranscript] = useState("");
  const [normalizedCommand, setNormalizedCommand] = useState("");
  const [confidence, setConfidence] = useState(null);
  const [latencyMs, setLatencyMs] = useState(null);
  const [errorText, setErrorText] = useState("");
  const [rawPayload, setRawPayload] = useState("");
  const providerRef = useRef(null);

  const stopProvider = () => {
    providerRef.current?.stop?.();
    providerRef.current?.cleanup?.();
    providerRef.current = null;
    setListeningStatus("stopped");
  };

  useEffect(() => stopProvider, []);

  const startListening = () => {
    stopProvider();
    setErrorText("");
    setRawTranscript("");
    setNormalizedCommand("");
    setConfidence(null);
    setLatencyMs(null);
    setRawPayload("");

    const provider = createVoiceProvider(providerId);
    providerRef.current = provider;
    setProviderName(provider.providerName);

    const isAvailable = provider.isAvailable?.() ?? provider.isSupported?.() ?? false;
    setAvailability(isAvailable ? "available" : "unavailable");
    if (!isAvailable) {
      setListeningStatus("unsupported");
      setErrorText("Provider unavailable in this browser or environment.");
      provider.cleanup?.();
      providerRef.current = null;
      return;
    }

    provider.onStateChange?.((state) => {
      const status = String(state || "unknown");
      if (status === "loading" || status.includes("Loading") || status.includes("Preparing")) {
        setModelLoadStatus(status);
      }

      if (status === "listening" || status === "retrying" || status === "stopped" || status === "error") {
        setListeningStatus(status);
      } else if (status) {
        setModelLoadStatus(status);
      }
    });

    provider.onError?.((error) => {
      setListeningStatus("error");
      setErrorText(error?.message || "Voice provider error.");
    });

    provider.onResult?.((result) => {
      const transcript = String(result?.transcript ?? "").trim();
      const command = normalizeTestCommand(transcript);
      setRawTranscript(transcript);
      setNormalizedCommand(command || "unmatched");
      setConfidence(result?.confidence ?? null);
      setLatencyMs(result?.latencyMs ?? null);
      setRawPayload(JSON.stringify(result ?? {}, null, 2));
    });

    setModelLoadStatus("loading");
    setListeningStatus("starting");
    provider.start();
  };

  const providerDescription = providerOptions.find((option) => option.id === providerId)?.description || providerName;

  if (!localAsrEnabled) {
    return (
      <main style={{ minHeight: "100vh", background: "#11111a", color: "#f0ece4", padding: "32px" }}>
        <h1 style={{ fontSize: "1.6rem", margin: 0 }}>Voice ASR Test</h1>
        <p style={{ color: "#b8b1d6" }}>Set `VITE_ENABLE_LOCAL_ASR=true` to enable this diagnostic panel outside dev.</p>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "#11111a", color: "#f0ece4", padding: "28px", fontFamily: "Inter, system-ui, sans-serif" }}>
      <section style={{ maxWidth: "960px", margin: "0 auto", display: "grid", gap: "20px" }}>
        <header style={{ display: "grid", gap: "8px" }}>
          <h1 style={{ fontSize: "1.7rem", margin: 0, letterSpacing: "0.02em" }}>Voice ASR Test</h1>
          <p style={{ margin: 0, color: "#b8b1d6", lineHeight: 1.5 }}>
            Select a provider, start listening, speak a target command, and inspect the provider output.
          </p>
        </header>

        <section style={{ background: "#20202d", border: "1px solid #373751", borderRadius: "8px", padding: "18px", display: "grid", gap: "16px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "end", gap: "12px" }}>
            <label style={{ display: "grid", gap: "6px", color: "#d8d4ee", fontSize: "0.84rem" }}>
              Provider
              <select
                value={providerId}
                onChange={(event) => {
                  stopProvider();
                  const nextProviderId = event.target.value;
                  const diagnostics = getProviderDiagnostics(nextProviderId);
                  setProviderId(nextProviderId);
                  setProviderName(diagnostics.providerName);
                  setAvailability(diagnostics.availability);
                  setModelLoadStatus("idle");
                  setErrorText("");
                }}
                title={providerDescription}
                style={{ minWidth: "230px", background: "#141420", border: "1px solid #474766", color: "#f0ece4", borderRadius: "6px", padding: "10px 12px", font: "inherit" }}
              >
                {providerOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={startListening}
              style={{ background: "#2563eb", color: "#ffffff", border: 0, borderRadius: "6px", padding: "11px 16px", font: "inherit", fontWeight: 700, cursor: "pointer" }}
            >
              Start listening
            </button>
            <button
              type="button"
              onClick={stopProvider}
              style={{ background: "#2d2d40", color: "#f0ece4", border: "1px solid #484867", borderRadius: "6px", padding: "10px 16px", font: "inherit", fontWeight: 700, cursor: "pointer" }}
            >
              Stop listening
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px", background: "#181824", border: "1px solid #303049", borderRadius: "8px", padding: "16px" }}>
            <Detail label="Selected provider" value={providerName} />
            <Detail label="Availability" value={availability} tone={availability === "available" ? "good" : "bad"} />
            <Detail label="Model load status" value={modelLoadStatus} />
            <Detail label="Listening status" value={listeningStatus} tone={listeningStatus === "error" ? "bad" : "neutral"} />
            <Detail label="Confidence" value={confidence} />
            <Detail label="Latency ms" value={latencyMs} />
          </div>

          <div style={{ display: "grid", gap: "12px" }}>
            <Detail label="Raw transcript" value={rawTranscript || "..."} />
            <Detail label="Normalized command" value={normalizedCommand || "..."} tone={normalizedCommand && normalizedCommand !== "unmatched" ? "good" : "neutral"} />
            <Detail label="Errors" value={errorText || "none"} tone={errorText ? "bad" : "neutral"} />
          </div>

          <details style={{ background: "#181824", border: "1px solid #303049", borderRadius: "8px", padding: "12px" }}>
            <summary style={{ cursor: "pointer", color: "#d8d4ee", fontWeight: 700 }}>Raw provider payload</summary>
            <pre style={{ margin: "12px 0 0", whiteSpace: "pre-wrap", color: "#b8b1d6", fontSize: "0.78rem", lineHeight: 1.5 }}>
              {rawPayload || "{}"}
            </pre>
          </details>
        </section>

        <section style={{ background: "#181824", border: "1px solid #303049", borderRadius: "8px", padding: "16px", display: "grid", gap: "10px" }}>
          <h2 style={{ margin: 0, fontSize: "1rem" }}>Target Commands</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {TARGET_COMMANDS.map((command) => (
              <span key={command} style={{ border: "1px solid #3c3c57", borderRadius: "999px", padding: "7px 10px", color: "#d8d4ee", background: "#222234", fontSize: "0.84rem" }}>
                {command}
              </span>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

# Shared Voice Engine

This document defines the reusable Shared Voice Engine architecture. It is a planning and documentation source of truth only; runtime implementation should happen in later, separately scoped tasks.

## Overview

The Shared Voice Engine is a general-purpose local voice system that PsiLabs can use first, without making the engine PsiLabs-specific.

The engine separates audio capture, VAD, ASR, normalization, mode routing, and event delivery. It emits stable app-agnostic events that a consumer app can interpret through its own adapter.

Primary goals:

- Keep the voice engine reusable outside PsiLabs.
- Keep speech detection separate from scoring and submission.
- Support desktop, web testing, and future mobile shells through the same protocol.
- Prefer local/private processing where practical.
- Make Tauri the primary desktop wrapper when desktop packaging begins.

## Architecture Layers

Target layers:

```text
React/Vite UI
-> voiceEngineClient
-> WebSocket + HTTP
-> Python Shared Voice Engine
-> Audio Capture
-> VAD
-> ASR Adapter
-> Normalization
-> Mode Router
-> Event Stream
-> Consumer Adapter
```

Layer ownership:

- React owns UI state, debug display, scorecards, selected expected command, and app-specific response behavior.
- The Python engine owns voice session lifecycle, audio capture, VAD, ASR execution, normalization profiles, mode routing, and voice event emission.
- Consumer adapters own app-specific interpretation. PsiLabs-specific scoring, expected-command checks, and submission rules must not live in the core engine.

## Platform Strategy

The voice engine core must not depend on Tauri, React, browser APIs, Capacitor, native mobile APIs, or PsiLabs.

Supported platform paths:

- Desktop: Tauri is the primary shell. It launches and supervises the Python engine as a sidecar process.
- Web: Browser usage remains a fallback/testing surface. The web app can keep existing browser providers or connect to an already-running engine service.
- Mobile: Future shells may use Tauri mobile, Capacitor, a native bridge, or a remote/local network service. Mobile integration must not require rewriting the engine.

Communication must stay consistent across platforms:

- WebSocket is the primary streaming event channel.
- HTTP is the secondary health, control, and metadata channel.
- Tauri IPC is only for desktop shell concerns such as launching the sidecar and passing endpoint details to the frontend.

## Tauri-First Desktop Shell

Tauri is the primary desktop wrapper for PsiLabs voice work.

Tauri responsibilities:

- Run the existing React/Vite frontend inside a desktop shell.
- Launch, monitor, and stop the Python voice engine sidecar.
- Provide a permission and trust boundary for local desktop capabilities.
- Pass sidecar endpoint details to React through IPC.
- Package the sidecar and model assets when desktop distribution begins.

Tauri must not own voice semantics. It should not define VAD behavior, ASR behavior, command grammar, scoring, or app submission behavior.

Electron can remain documented as a fallback only if Tauri blocks a required capability. It is not the default desktop path.

The `src-tauri/` runtime should not be created during the documentation-only phase.

## Future Mobile Shell Strategy

Mobile support is a design constraint, not an active implementation task.

Mobile constraints:

- iOS should not be assumed to support Python sidecar processes.
- Mobile may need native mic capture, a native bridge, or a remote/local network service.
- Model size, battery use, latency, and OS microphone permissions will shape the final mobile path.

The engine contract must remain portable:

- Same event schema.
- Same WebSocket event stream.
- Same HTTP control/config endpoints.
- Same mode profile concepts.
- Different shell/bridge layer only.

## Future Next.js Refactor Boundary

Use Vite while discovering the engine. Consider Next.js when PsiLabs becomes a platform.

Do not migrate PsiLabs from React/Vite to Next.js during Shared Voice Engine, VAD, ASR, or Tauri sidecar work. A Next.js migration would be a separate platform refactor.

Next.js becomes worth reconsidering when one or more of these become central:

- Public protocol library.
- User accounts or auth-heavy product flows.
- Server-rendered pages.
- SEO/indexable content.
- API routes tightly coupled to the app.
- Community or social features.
- Multi-page documentation/product site.
- Hosted web app as a major primary surface.

Keep current code portable by isolating engine clients and adapters in `src/lib` and avoiding framework-specific assumptions in the voice protocol.

## Event Schema

The engine emits app-agnostic voice events.

Example event:

```json
{
  "schemaVersion": "voice-event.v1",
  "id": "event-id",
  "type": "voice.final_transcript",
  "sessionId": "session-id",
  "turnId": "turn-id",
  "mode": "scientific",
  "source": "vosk",
  "timestamp": "2026-04-30T00:00:00.000Z",
  "sequence": 42,
  "text": "red",
  "confidence": 0.92,
  "latencyMs": 180,
  "payload": {},
  "error": null
}
```

Core event types:

- `voice.vad_started`
- `voice.vad_ended`
- `voice.partial_transcript`
- `voice.final_transcript`
- `voice.command_detected`
- `voice.mode_changed`
- `voice.engine_status`
- `voice.error`

PsiLabs-specific fields such as expected command, scored/unscored attempt, hit/miss, and response submission should be added by the PsiLabs consumer adapter or debug UI, not by the core engine.

## Session Lifecycle Authority

The Python Shared Voice Engine is the source of truth for voice session lifecycle.

Frontend clients may request start, stop, and mode changes. The engine assigns:

- `sessionId`
- `turnId`
- `sequence`
- event timestamps

This prevents desync between UI, engine logs, desktop shells, and future mobile shells.

PsiLabs experiment/session state remains owned by PsiLabs. Voice session lifecycle authority does not mean the engine owns trial state, scoring, participant data, or app navigation.

## Streaming Control And Backpressure

The engine must support bounded buffering and streaming control.

Events that can become noisy:

- Frequent partial transcripts.
- Rapid VAD start/end toggling.
- Reconnect replay.
- Slow clients.
- UI event overload.

Engine requirements:

- Keep bounded per-client buffers.
- Do not let slow clients block VAD or ASR processing.
- Preserve sequence ordering for emitted events.
- Support a latest-state snapshot for reconnects.
- Support a bounded full-stream replay window for diagnostics.
- Allow partial transcripts to be coalesced or dropped according to client mode.

Client modes:

- `latest-only`: useful for dashboards and simple status displays.
- `full-stream`: useful for diagnostics, replay, and ASR testing.

## Audio Source Abstraction

Audio capture is pluggable. VAD and ASR should not care where audio came from.

Supported and planned source IDs:

- `python_local`: desktop default microphone capture inside the Python engine.
- `browser_stream`: web testing or browser bridge.
- `remote_stream`: network stream from another service or device.
- `native_mobile`: future native mobile mic bridge.

Platform defaults:

- Desktop default: `python_local`.
- Web testing: `browser_stream` or an already-running local engine.
- Mobile future: `native_mobile` or `remote_stream`.

## VAD Strategy

Silero is the preferred VAD adapter for the first real engine path.

Default mode profile should use Silero, preferably through an ONNX runtime path if that simplifies packaging.

Fallback/testing VAD adapters:

- WebRTC VAD for lightweight comparison.
- Energy-threshold VAD for simple debugging and fixtures.
- Mock VAD for deterministic tests.

The VAD layer should emit `voice.vad_started` and `voice.vad_ended` independently of whether ASR produces a transcript.

## ASR Adapter Strategy

ASR adapters should be swappable behind a stable interface.

Initial targets:

- Vosk adapter for local/offline command recognition.
- Sherpa ONNX adapter for local/offline streaming recognition.
- Mock adapter for deterministic event tests.

Browser `vosk-browser` and Sherpa WASM diagnostics remain useful for comparison, but the shared engine's long-term local path is Python-side and platform-independent.

## Mode Profiles

Modes are config-driven profiles, not hardcoded branches in engine core.

Initial mode IDs:

- `scientific`
- `language`
- `game_actions`
- `coding_dictation`
- `general_dictation`
- `calibration`
- `test_mode`

Example profile:

```yaml
id: scientific
audioSource:
  type: python_local
vad:
  adapter: silero
  runtime: onnx
  sensitivity: 0.45
  minSpeechMs: 80
  maxSilenceMs: 350
asr:
  adapter: vosk
normalization:
  profile: grammar
latencyBudgetMs: 300
streaming:
  partials: true
  clientMode: full-stream
```

Each mode may tune VAD sensitivity, latency tolerance, ASR model/config, normalization profile, command grammar, and event policy.

## Sidecar Startup Contract

When Tauri launches the Python engine sidecar, the ready payload must include protocol version:

```json
{
  "httpUrl": "http://127.0.0.1:xxxxx",
  "wsUrl": "ws://127.0.0.1:xxxxx/v1/events",
  "token": "...",
  "protocolVersion": "v1"
}
```

The frontend should connect through the URLs and token from this payload. Web testing may receive the same values through env/config/manual entry instead of Tauri IPC.

The protocol version lets clients fail clearly when the shell, frontend, and sidecar are out of sync.

## PsiLabs First Integration

PsiLabs should be the first consumer, not the thing the engine is built around.

First integration target:

- `/#voice-asr-test`
- Existing Voice Debug Console event display.
- Existing ASR scorecard/debug workflow.

Initial PsiLabs consumer adapter responsibilities:

- Render raw engine events.
- Normalize app-facing command display if needed.
- Attach expected command and scored/unscored attempt metadata outside the engine.
- Keep speech detection separate from selection, scoring, and submission.

Do not wire Shared Voice Engine output into TrainingRoom or CalibrationRoom submissions during the architecture/documentation phase.

## Implementation Sequence

1. Finalize documentation and event schema.
2. Build a mock Python engine that emits deterministic WebSocket events.
3. Add a React voice engine client that consumes mock events in `/#voice-asr-test`.
4. Add Silero VAD and VAD boundary events.
5. Add Vosk and Sherpa Python ASR adapters.
6. Add Tauri shell integration for sidecar launch and endpoint discovery.
7. Run the full desktop test loop: Tauri app -> sidecar -> mic -> VAD -> ASR -> debug UI.
8. Consider mobile shell integration only after the desktop and protocol paths stabilize.

## Risks

- Tauri sidecar startup, shutdown, crash recovery, and endpoint discovery.
- Cross-platform packaging differences across Windows, macOS, and Linux.
- Mobile limitations, especially no Python sidecar assumption on iOS.
- Slow-client backpressure and UI event overload.
- Engine independence from Tauri IPC and PsiLabs-specific state.
- Session ID and sequence conflicts if frontend-generated IDs leak in.
- Model size, model licensing, and distribution.
- Silero runtime packaging and dependency weight.
- ASR adapter dependency drift.
- Real-time latency for game/action modes.
- Microphone permissions across browsers, desktop shells, and OSes.
- Privacy expectations around local versus remote processing.

## Explicit Non-Goals

Do not implement these in the documentation phase:

- Runtime Python engine.
- `src-tauri/` desktop shell.
- VAD or ASR adapters.
- Next.js migration.
- Mobile shell runtime.
- TrainingRoom or CalibrationRoom voice submission.
- Production model installer or updater.
- Electron wrapper.

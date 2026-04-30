# Local Voice ASR Model Assets

PsiLabs can test Browser Speech, Vosk Local, and Sherpa ONNX Local from the voice ASR diagnostic panel.

Open the panel in dev at:

```text
http://127.0.0.1:5173/#voice-asr-test
```

Set local ASR env values in `.env.local` when needed:

```text
VITE_ENABLE_LOCAL_ASR=true
VITE_VOSK_MODEL_URL=/models/vosk/model.tar.gz
VITE_SHERPA_ONNX_ASSET_BASE_URL=/models/sherpa-onnx/
```

## Vosk Local

Default model path:

```text
public/models/vosk/model.tar.gz
```

Env override:

```text
VITE_VOSK_MODEL_URL=/models/vosk/model.tar.gz
```

The Vosk provider uses `vosk-browser` and a constrained grammar for short command testing. The model archive should be a Vosk browser-compatible `.tar.gz` model archive.

## Sherpa ONNX Local

Default asset base path:

```text
public/models/sherpa-onnx/
```

Env override:

```text
VITE_SHERPA_ONNX_ASSET_BASE_URL=/models/sherpa-onnx/
```

Expected files include the official browser WebAssembly ASR build outputs:

- `sherpa-onnx-asr.js`
- `sherpa-onnx-wasm-main-asr.js`
- related `.wasm` files
- related `.data` and model files

The provider also checks the alternate main script name `sherpa-onnx-wasm-asr-main.js` because Sherpa example builds can vary by release.

## Manual Test Flow

1. Start the dev server.
2. Open `/#voice-asr-test`.
3. Select `Browser Speech`, `Vosk Local`, or `Sherpa ONNX Local`.
4. Press `Start listening`.
5. Speak test commands.
6. Watch raw transcript, normalized command, confidence, latency, status, and errors.
7. Press `Stop listening` before switching providers if you want a clean reset.

Target test commands:

- `red`
- `blue`
- `press A`
- `press D`
- `space`
- `submit`
- `calibration`
- `test`
- `results`

## Troubleshooting

- Missing Vosk model archive: confirm `public/models/vosk/model.tar.gz` exists or set `VITE_VOSK_MODEL_URL`.
- Wrong Sherpa asset path: confirm `public/models/sherpa-onnx/` exists or set `VITE_SHERPA_ONNX_ASSET_BASE_URL`.
- WASM MIME/path issues: serve through Vite or another HTTP server; do not open `index.html` directly from the filesystem.
- Mic permission denied: allow microphone access for the local dev origin and restart listening.
- Model load timeout: confirm model assets are reachable in the browser network panel and are not blocked by CORS or path mistakes.
- Provider unavailable: Browser Speech depends on browser support; local providers require Web Audio microphone access.
- Vosk large chunk warning: expected. The `vosk-browser` runtime is lazy-loaded when the provider starts.

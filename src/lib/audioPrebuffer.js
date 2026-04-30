export const DEFAULT_PREBUFFER_OPTIONS = {
  sampleRate: 16000,
  prebufferMs: 750,
};

export function createRollingAudioPrebuffer(options = {}) {
  const sampleRate = options.sampleRate ?? DEFAULT_PREBUFFER_OPTIONS.sampleRate;
  const prebufferMs = options.prebufferMs ?? DEFAULT_PREBUFFER_OPTIONS.prebufferMs;
  const maxSamples = Math.max(1, Math.ceil((sampleRate * prebufferMs) / 1000));
  const buffer = new Float32Array(maxSamples);
  let writeIndex = 0;
  let sampleCount = 0;

  return {
    sampleRate,
    prebufferMs,
    push(samples) {
      if (!samples) return;
      const input = samples instanceof Float32Array ? samples : Float32Array.from(samples);
      for (let index = 0; index < input.length; index += 1) {
        buffer[writeIndex] = input[index];
        writeIndex = (writeIndex + 1) % maxSamples;
        sampleCount = Math.min(sampleCount + 1, maxSamples);
      }
    },
    getPrebuffer() {
      const output = new Float32Array(sampleCount);
      const start = (writeIndex - sampleCount + maxSamples) % maxSamples;
      for (let index = 0; index < sampleCount; index += 1) {
        output[index] = buffer[(start + index) % maxSamples];
      }
      return output;
    },
    clear() {
      writeIndex = 0;
      sampleCount = 0;
      buffer.fill(0);
    },
  };
}

function resampleLinear(input, sourceRate, targetRate) {
  if (sourceRate === targetRate) {
    return input instanceof Float32Array ? input : Float32Array.from(input);
  }

  const outputLength = Math.max(1, Math.round((input.length * targetRate) / sourceRate));
  const output = new Float32Array(outputLength);
  const ratio = (input.length - 1) / Math.max(1, outputLength - 1);

  for (let index = 0; index < outputLength; index += 1) {
    const sourceIndex = index * ratio;
    const leftIndex = Math.floor(sourceIndex);
    const rightIndex = Math.min(input.length - 1, leftIndex + 1);
    const weight = sourceIndex - leftIndex;
    output[index] = input[leftIndex] * (1 - weight) + input[rightIndex] * weight;
  }

  return output;
}

export function createWebAudioPrebuffer(options = {}) {
  const sampleRate = options.sampleRate ?? DEFAULT_PREBUFFER_OPTIONS.sampleRate;
  const prebuffer = createRollingAudioPrebuffer({
    sampleRate,
    prebufferMs: options.prebufferMs ?? DEFAULT_PREBUFFER_OPTIONS.prebufferMs,
  });
  const onAudio = typeof options.onAudio === "function" ? options.onAudio : () => {};
  const bufferSize = options.bufferSize ?? 4096;
  let audioContext = null;
  let mediaStream = null;
  let sourceNode = null;
  let processorNode = null;

  const stop = async () => {
    try {
      processorNode?.disconnect();
      sourceNode?.disconnect();
    } catch {
      // Ignore disconnect races during teardown.
    }

    processorNode = null;
    sourceNode = null;

    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      mediaStream = null;
    }

    if (audioContext) {
      await audioContext.close().catch(() => {});
      audioContext = null;
    }
  };

  return {
    sampleRate,
    prebuffer,
    async start() {
      if (audioContext) {
        return;
      }

      if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        throw new Error("Web Audio microphone capture is not available in this browser.");
      }

      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextCtor) {
        throw new Error("Web Audio is not available in this browser.");
      }

      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      audioContext = new AudioContextCtor();
      sourceNode = audioContext.createMediaStreamSource(mediaStream);
      processorNode = audioContext.createScriptProcessor(bufferSize, 1, 1);

      processorNode.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0);
        const output = event.outputBuffer.getChannelData(0);
        output.fill(0);
        const resampled = resampleLinear(input, audioContext.sampleRate, sampleRate);
        prebuffer.push(resampled);
        onAudio(resampled);
      };

      sourceNode.connect(processorNode);
      processorNode.connect(audioContext.destination);
    },
    stop,
    getPrebuffer() {
      return prebuffer.getPrebuffer();
    },
    clear() {
      prebuffer.clear();
    },
  };
}

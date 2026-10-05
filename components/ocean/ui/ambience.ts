// The supplied ambience lives in public/audio; keep the asset path in one place.
export const ambienceUrl = "/audio/dragon-studio-deep-sea-underwater-ambience-472383.mp3";

export function prepareAmbienceLoop(buffer: AudioBuffer) {
  // Bake a short overlapping join once, then let Web Audio loop sample-accurately.
  // Complementary smooth weights avoid both a hard seam and a gain bump.
  const overlap = Math.min(Math.round(buffer.sampleRate * .25), Math.floor(buffer.length / 4));
  if (overlap < 2) return buffer.duration;
  const length = buffer.length - overlap;
  // Reuse the decoded buffer: a second full copy of this long track is costly on mobile.
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const samples = buffer.getChannelData(channel);
    for (let frame = 0; frame < overlap; frame++) {
      const progress = frame / (overlap - 1);
      const weight = progress * progress * (3 - 2 * progress);
      samples[frame] = samples[length + frame] * (1 - weight) + samples[frame] * weight;
    }
  }
  return length / buffer.sampleRate;
}

export function createAmbiencePlayer(url: string, onError: (failed: boolean) => void) {
  let context: AudioContext | undefined;
  let gain: GainNode | undefined;
  let source: AudioBufferSourceNode | undefined;
  let loading: Promise<void> | undefined;
  let disposed = false;
  let volume = .75;
  const abort = new AbortController();

  function setVolume(next: number) {
    volume = next;
    if (!context || !gain || !source) return;
    // setTargetAtTime smoothly retargets even during a rapid slider drag.
    gain.gain.setTargetAtTime(volume, context.currentTime, .045);
  }

  async function start() {
    if (disposed) return;
    try {
      if (!context) {
        context = new AudioContext();
        gain = context.createGain();
        gain.gain.value = 0;
        gain.connect(context.destination);
      }
      // Called directly from a trusted gesture, before any fetch/decode awaits.
      const resumed = context.resume();
      if (!source && !loading) {
        const currentContext = context;
        const currentGain = gain!;
        loading = (async () => {
          const response = await fetch(url, { signal: abort.signal });
          if (!response.ok) throw new Error(`Ambience request failed: ${response.status}`);
          const decoded = await currentContext.decodeAudioData(await response.arrayBuffer());
          if (disposed) return;
          source = currentContext.createBufferSource();
          source.buffer = decoded;
          source.loopEnd = prepareAmbienceLoop(decoded);
          source.loop = true;
          source.connect(currentGain);
          source.start();
          setVolume(volume);
          onError(false);
        })().catch(() => {
          if (!disposed) onError(true);
        }).finally(() => { loading = undefined; });
      }
      await resumed;
      if (source && !disposed) onError(false);
    } catch {
      // Keep gesture listeners installed so a blocked/interrupted context can retry.
      if (!disposed) onError(true);
    }
  }

  function dispose() {
    disposed = true;
    abort.abort();
    source?.stop();
    source?.disconnect();
    gain?.disconnect();
    if (context && context.state !== "closed") void context.close().catch(() => {});
  }

  return { start, setVolume, dispose };
}

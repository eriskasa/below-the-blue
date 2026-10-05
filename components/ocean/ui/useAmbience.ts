"use client";

import { useEffect, useRef, useState } from "react";
import { ambienceUrl, createAmbiencePlayer } from "./ambience";

export function useAmbience(volume: number, muted: boolean) {
  const player = useRef<ReturnType<typeof createAmbiencePlayer> | null>(null);
  const unlocked = useRef(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const audio = createAmbiencePlayer(ambienceUrl, setFailed);
    player.current = audio;
    const unlock = (event: PointerEvent | KeyboardEvent) => {
      if (!unlocked.current) return;
      if (!event.isTrusted) return;
      if (event instanceof PointerEvent && (!event.isPrimary || event.button !== 0)) return;
      if (event instanceof KeyboardEvent && (event.repeat || event.ctrlKey || event.metaKey || event.altKey)) return;
      void audio.start();
    };
    // Capture also hears the existing joystick, which stops pointer propagation.
    window.addEventListener("pointerdown", unlock, true);
    // Touch browsers may grant autoplay activation only when the finger lifts.
    window.addEventListener("pointerup", unlock, true);
    window.addEventListener("keydown", unlock, true);
    return () => {
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("pointerup", unlock, true);
      window.removeEventListener("keydown", unlock, true);
      audio.dispose();
      player.current = null;
    };
  }, []);

  useEffect(() => { player.current?.setVolume(muted ? 0 : volume / 100); }, [volume, muted]);
  return { failed, start: () => {
    unlocked.current = true;
    void player.current?.start();
  } };
}

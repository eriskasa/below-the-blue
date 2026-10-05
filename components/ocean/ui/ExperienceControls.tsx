"use client";

import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { changeVolume, toggleMute, whaleColors } from "./preferences";
import type { Preferences, WhaleColor } from "./preferences";
import styles from "./ExperienceControls.module.css";

function SoundIcon({ muted }: { muted: boolean }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M11 5 6 9H3v6h3l5 4V5Z" />
    {muted ? <path d="m16 9 6 6m0-6-6 6" /> : <><path d="M15 8a6 6 0 0 1 0 8" /><path d="M18 5a10 10 0 0 1 0 14" /></>}
  </svg>;
}

export function ExperienceControls({ preferences, setPreferences, color, audioFailed }: {
  preferences: Preferences;
  setPreferences: Dispatch<SetStateAction<Preferences>>;
  color: WhaleColor;
  audioFailed: boolean;
}) {
  const [panel, setPanel] = useState<"sound" | "color" | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const soundButton = useRef<HTMLButtonElement>(null);
  const colorButton = useRef<HTMLButtonElement>(null);
  const soundPanel = useRef<HTMLDivElement>(null);
  const colorPanel = useRef<HTMLDivElement>(null);
  const silent = preferences.muted || preferences.volume === 0;

  useEffect(() => {
    if (!panel) return;
    const element = panel === "sound" ? soundPanel.current : colorPanel.current;
    element?.querySelector<HTMLElement>(panel === "sound" ? "input" : '[aria-pressed="true"]')?.focus();
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Element && !event.target.closest("[data-experience-control]")) setPanel(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setPanel(null);
      (panel === "sound" ? soundButton : colorButton).current?.focus();
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [panel]);

  return <>
    <div className={`${styles.control} ${styles.info}`} data-experience-control>
      <button type="button" className={`${styles.button} ${styles.iconButton}`} aria-label="About this ocean" aria-haspopup="dialog"
        onClick={() => { setPanel(null); dialog.current?.showModal(); }}>
        <span className={styles.infoIcon} aria-hidden="true">ⓘ</span>
      </button>
    </div>

    <div className={`${styles.control} ${styles.color}`} data-experience-control>
      <button ref={colorButton} type="button" className={`${styles.button} ${styles.iconButton}`} aria-label={`Whale color: ${color.name}`}
        aria-expanded={panel === "color"} aria-controls="whale-colors" onClick={() => setPanel(panel === "color" ? null : "color")}>
        <span className={styles.colorPreview} style={{ backgroundColor: color.value }} aria-hidden="true" />
      </button>
      {panel === "color" && <div ref={colorPanel} id="whale-colors" className={`${styles.panel} ${styles.colorPanel}`} role="group" aria-label="Whale body color">
        <p className={styles.label}>A shade for your whale</p>
        <div className={styles.swatches}>
          {whaleColors.map(swatch => <button key={swatch.value} type="button" className={styles.swatch} aria-label={swatch.name}
            title={swatch.name} aria-pressed={preferences.color === swatch.value}
            onClick={() => setPreferences(previous => ({ ...previous, color: swatch.value }))}>
            <span style={{ backgroundColor: swatch.value }} aria-hidden="true">{preferences.color === swatch.value ? "✓" : ""}</span>
          </button>)}
        </div>
      </div>}
    </div>

    <div className={`${styles.control} ${styles.sound}`} data-experience-control>
      {panel === "sound" && <div ref={soundPanel} id="ocean-sound" className={`${styles.panel} ${styles.soundPanel}`} role="group" aria-label="Underwater ambience">
        <div className={styles.volumeRow}>
          <button type="button" className={styles.mute} aria-label={silent ? "Unmute ambience" : "Mute ambience"} aria-pressed={silent}
            onClick={() => setPreferences(toggleMute)}><SoundIcon muted={silent} /></button>
          <input type="range" min="0" max="100" step="1" value={silent ? 0 : preferences.volume} aria-label="Ambience volume" aria-valuetext={`${silent ? 0 : preferences.volume}%`}
            onChange={event => setPreferences(previous => changeVolume(previous, Number(event.target.value)))} />
          <output className={styles.volumeValue}>{silent ? 0 : preferences.volume}%</output>
        </div>
        {audioFailed && <p className={styles.audioStatus} role="status">Ambience unavailable. Tap Sound to retry.</p>}
      </div>}
      <button ref={soundButton} type="button" className={styles.button} aria-expanded={panel === "sound"} aria-controls="ocean-sound"
        onClick={() => setPanel(panel === "sound" ? null : "sound")}>
        <SoundIcon muted={silent} /><span>Sound</span>
      </button>
    </div>

    <dialog ref={dialog} className={styles.dialog} aria-labelledby="ocean-info-title" aria-describedby="ocean-info-description"
      onClick={event => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
      <article className={styles.infoCard}>
        <button type="button" className={styles.close} aria-label="Close info" onClick={() => dialog.current?.close()}>×</button>
        <h1 id="ocean-info-title">Explore the Deep</h1>
        <div id="ocean-info-description">
          <p>Swim through a peaceful ocean and discover creatures hidden below the surface. Some may have riddles, patterns, or small puzzles for you to solve.</p>
          <p>Explore at your own pace.</p>
        </div>
        <div className={styles.instructions}>
          <h2>Controls</h2>
          <p><span>↑ ↓ ← → / WASD</span><span>Swim</span></p>
          <p><span>Mobile</span><span>Use the joystick</span></p>
        </div>
      </article>
    </dialog>
  </>;
}

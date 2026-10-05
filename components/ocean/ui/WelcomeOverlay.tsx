"use client";

import { useEffect, useRef } from "react";
import styles from "./WelcomeOverlay.module.css";

export function WelcomeOverlay({ leaving, onStart, onExited }: {
  leaving: boolean;
  onStart: () => void;
  onExited: () => void;
}) {
  const startButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { startButton.current?.focus({ preventScroll: true }); }, []);

  return <div className={styles.overlay} data-leaving={leaving} role="dialog" aria-modal="true"
    aria-labelledby="welcome-title" aria-describedby="welcome-description welcome-controls"
    onAnimationEnd={event => {
      if (leaving && event.target === event.currentTarget) onExited();
    }}
    onPointerDown={event => { if (event.target === event.currentTarget) event.preventDefault(); }}
    onKeyDown={event => {
      event.stopPropagation();
      if (event.key === "Escape" || event.key === "Tab") {
        event.preventDefault();
        startButton.current?.focus({ preventScroll: true });
      }
    }}>
    <section className={styles.card}>
      <h1 id="welcome-title">EXPLORE THE DEEP</h1>
      <p id="welcome-description" className={styles.description}>Swim through the ocean, descend into darker waters, and discover creatures with puzzles and mysteries to solve.</p>
      <div id="welcome-controls" className={styles.controls}>
        <p><span>WASD / Arrow Keys</span> — Swim</p>
        <p className={styles.touchHint}>On mobile, drag the joystick to swim.</p>
        <p>Explore deeper to discover new encounters.</p>
      </div>
      <button ref={startButton} type="button" className={styles.start} aria-disabled={leaving}
        onClick={() => { if (!leaving) onStart(); }}>Start Exploring</button>
      <p className={styles.footer}>Explore at your own pace.</p>
    </section>
  </div>;
}

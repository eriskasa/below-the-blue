"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import type { PuzzlePresentation } from "../encounters/puzzlePresentation";
import styles from "./PuzzleMode.module.css";

export function PuzzleMode({ presentation, title, children, footer, onClose, onEscape }: {
  presentation: PuzzlePresentation;
  title: string;
  children: ReactNode;
  footer: ReactNode;
  onClose: () => void;
  onEscape: () => void;
}) {
  const { phase } = useSyncExternalStore(presentation.subscribe, presentation.getSnapshot, presentation.getSnapshot);
  const root = useRef<HTMLDivElement>(null);
  const open = phase !== "exploration";

  useEffect(() => {
    if (!open) return;
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onEscape(); }
      if (event.key !== "Tab") return;
      const buttons = Array.from(root.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled):not([aria-disabled="true"])') ?? []);
      if (!buttons.length) { event.preventDefault(); return; }
      const index = buttons.findIndex(button => button === document.activeElement);
      event.preventDefault();
      buttons[(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus({ preventScroll: true });
    };
    document.addEventListener("keydown", keyboard, true);
    return () => document.removeEventListener("keydown", keyboard, true);
  }, [open, onEscape]);

  useEffect(() => {
    if (phase === "entering") root.current?.querySelector<HTMLButtonElement>("[data-close-puzzle]")?.focus({ preventScroll: true });
    if (phase === "active") root.current?.querySelector<HTMLButtonElement>("[data-start]")?.focus({ preventScroll: true });
  }, [phase]);

  if (!open) return null;
  return <div ref={root} className={styles.layer} data-phase={phase} role="dialog" aria-modal="true" aria-labelledby="puzzle-title">
    <section className={styles.frame}>
      <button type="button" data-close-puzzle className={styles.close} aria-label="Close puzzle" aria-disabled={phase === "leaving"}
        onClick={() => { if (phase !== "leaving") onClose(); }}>×</button>
      <header className={styles.header}>
        <h2 id="puzzle-title">{title}</h2>
        <div className={styles.instruction} role="status">{children}</div>
      </header>
      <div ref={element => presentation.setArea(element)} className={styles.creatures} aria-hidden="true" />
      <footer className={styles.footer}>{footer}</footer>
    </section>
    {/* Accessible hit targets follow the real Three.js meshes into this layer. */}
    <div ref={element => presentation.setTargets(element)} className={styles.targets} />
  </div>;
}

"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import type { EncounterContent, EncounterController } from "./encounter";
import type { PuzzlePresentation } from "./puzzlePresentation";
import { PuzzleMode } from "../ui/PuzzleMode";
import styles from "./EncounterUI.module.css";

// Rendered by the creature's world-space Html anchor, never by PuzzleMode.
export function EncounterInvitation({ encounter, content, showDescription = false }: { encounter: EncounterController; content: EncounterContent; showDescription?: boolean }) {
  const state = useSyncExternalStore(encounter.subscribe, encounter.getSnapshot, encounter.getSnapshot);
  useEffect(() => {
    if (state.stage !== "invitation") return;
    const keyboard = (event: KeyboardEvent) => {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      const inWorld = target === document.body || target instanceof HTMLCanvasElement || (target instanceof HTMLElement && target.hasAttribute("data-movement-control"));
      if (inWorld && (event.key.toLowerCase() === "e" || event.key === "Enter")) {
        event.preventDefault();
        encounter.play();
      }
    };
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, [encounter, state.stage]);
  if (state.stage !== "invitation") return null;
  const title = state.completed ? content.replayTitle ?? content.title : content.title;
  return <section className={styles.invitation} aria-label={title} data-encounter-ui onPointerDown={event => event.stopPropagation()}>
    <h2>{title}</h2>
    {showDescription && <p>{content.description}</p>}
    <button type="button" className={styles.primary} onClick={encounter.play}>{state.completed ? "Play Again" : "Play"}<span className={styles.shortcut}>E / Enter</span></button>
  </section>;
}

export function EncounterUI({ encounter, content, presentation, progress }: {
  encounter: EncounterController;
  content: EncounterContent;
  presentation: PuzzlePresentation;
  progress?: ReactNode;
}) {
  const state = useSyncExternalStore(encounter.subscribe, encounter.getSnapshot, encounter.getSnapshot);
  const { phase } = useSyncExternalStore(presentation.subscribe, presentation.getSnapshot, presentation.getSnapshot);
  const hint = useRef<HTMLDivElement>(null);
  const canHint = ["watching", "repeat", "retry"].includes(state.stage);

  useEffect(() => {
    if (phase === "active" && state.stage === "repeat") presentation.getTargets()?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({ preventScroll: true });
    if (state.stage === "watching") presentation.getArea()?.closest('[role="dialog"]')?.querySelector<HTMLButtonElement>("[data-close-puzzle]")?.focus({ preventScroll: true });
  }, [phase, state.stage, presentation]);

  useEffect(() => {
    if (!state.hintOpen) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !hint.current?.contains(event.target)) encounter.toggleHint();
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [encounter, state.hintOpen]);

  const status = state.stage === "instruction" ? content.instructionText
    : state.stage === "watching" ? content.watchText ?? "Watch closely…"
    : state.stage === "repeat" ? content.repeatText ?? "Your turn."
    : state.stage === "retry" ? content.retryText ?? "Try once more."
    : state.stage === "message" ? content.successText : "";

  return <PuzzleMode presentation={presentation} title={content.instructionTitle} onClose={encounter.leave}
    onEscape={() => { if (state.hintOpen) encounter.toggleHint(); else if (phase !== "leaving") encounter.leave(); }}
    footer={<>
      {state.stage === "instruction" && <button type="button" data-start className={styles.primary} disabled={phase !== "active"} onClick={encounter.start}>Start</button>}
      {canHint && <div ref={hint} className={styles.hint}>
        <button type="button" aria-expanded={state.hintOpen} aria-controls="encounter-hint" onClick={encounter.toggleHint}>? Hint</button>
        {state.hintOpen && <div id="encounter-hint" className={styles.hintCard}>
          <p>{content.hintText}</p>
          <button type="button" aria-label="Close hint" onClick={encounter.toggleHint}>×</button>
        </div>}
      </div>}
    </>}>
    {status}
    {progress}
  </PuzzleMode>;
}

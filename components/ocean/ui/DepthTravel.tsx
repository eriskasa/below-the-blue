"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties } from "react";
import { depthZones } from "../depth";
import type { ExplorationProgress } from "../progress/explorationProgress";
import { travelFadeMs } from "../progress/travel";
import styles from "./DepthTravel.module.css";

export function DepthTravel({ progress, onTravel }: { progress: ExplorationProgress; onTravel: () => void }) {
  const state = useSyncExternalStore(progress.subscribe, progress.getSnapshot, progress.getSnapshot);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  const current = depthZones.find(zone => zone.id === state.currentZone)!;
  return <div ref={root} className={styles.control} data-depth-travel onKeyDown={event => {
    if (event.key === "Escape") { event.stopPropagation(); setOpen(false); trigger.current?.focus(); }
  }} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <button ref={trigger} className={styles.trigger} type="button" aria-expanded={open} aria-controls="depth-travel"
      onClick={() => setOpen(value => !value)} aria-label={`Depth travel: ${current.name}`}>
      {current.name}<span aria-hidden="true">⌄</span>
    </button>
    {open && <section id="depth-travel" className={styles.panel} aria-label="Travel to">
      <p>Travel to</p>
      {depthZones.map(zone => {
        const unlocked = state.discoveredZones.includes(zone.id);
        const here = zone.id === state.currentZone;
        return <button type="button" key={zone.id} disabled={!unlocked} aria-current={here ? "location" : undefined}
          onClick={() => {
            if (progress.requestTravel(zone.id)) { setOpen(false); onTravel(); }
          }}>
          <span>{zone.name}</span><span className={styles.status}>{!unlocked ? "Locked" : here ? "Here" : ""}</span>
        </button>;
      })}
    </section>}
  </div>;
}

export function TravelFade({ progress }: { progress: ExplorationProgress }) {
  const { travelPhase } = useSyncExternalStore(progress.subscribe, progress.getSnapshot, progress.getSnapshot);
  if (travelPhase === "idle") return null;
  return <div key={travelPhase} className={styles.fade} data-phase={travelPhase} aria-hidden="true"
    style={{ "--travel-fade": `${travelFadeMs}ms` } as CSSProperties}
    onAnimationEnd={event => {
      if (event.target !== event.currentTarget) return;
      if (travelPhase === "outgoing") progress.covered();
      if (travelPhase === "incoming") progress.finishTravel();
    }} />;
}

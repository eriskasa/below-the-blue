"use client";

import dynamic from "next/dynamic";
import { Component, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { clearMovementInput, createMovementInput } from "./movementInput";
import { TouchJoystick } from "./TouchJoystick";
import { ExperienceControls } from "./ui/ExperienceControls";
import { usePreferences } from "./ui/usePreferences";
import { whaleColors } from "./ui/preferences";
import { createDepthState } from "./depth";
import { DepthOverlay } from "./ui/DepthOverlay";
import { createFishEncounter, fishEncounter } from "./encounters/fishEncounter";
import { createOctopusEncounter, octopusEncounter } from "./encounters/octopusEncounter";
import { OctopusUI } from "./encounters/OctopusUI";
import { EncounterUI } from "./encounters/EncounterUI";
import { createPuzzlePresentation } from "./encounters/puzzlePresentation";
import { PuzzleFocus } from "./ui/PuzzleFocus";
import { WelcomeOverlay } from "./ui/WelcomeOverlay";
import { useAmbience } from "./ui/useAmbience";

import { createExplorationProgress } from "./progress/explorationProgress";
import { browserProgressStorage } from "./progress/progress";
import { DepthTravel, TravelFade } from "./ui/DepthTravel";

const Scene = dynamic(() => import("./Scene"), {
  ssr: false,
  loading: () => <p className="scene-status">Entering the blue…</p>,
});

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed
      ? <p className="scene-status" role="alert">The ocean could not load. Check WebGL support and reload to try again.</p>
      : this.props.children;
  }
}

export default function Experience() {
  const [startPhase, setStartPhase] = useState<"welcome" | "starting" | "playing">("welcome");
  const gameStarted = startPhase === "playing";
  const gameplay = useRef<HTMLDivElement>(null);
  const input = useRef(createMovementInput());
  const [depthState] = useState(() => createDepthState());
  const depth = useRef(depthState);
  const [encounter] = useState(() => createFishEncounter());
  const [presentation] = useState(() => createPuzzlePresentation(encounter));
  const puzzle = useSyncExternalStore(presentation.subscribe, presentation.getSnapshot, presentation.getSnapshot);
  const [octopus] = useState(() => createOctopusEncounter());
  const [octopusPresentation] = useState(() => createPuzzlePresentation(octopus));
  const octopusPuzzle = useSyncExternalStore(octopusPresentation.subscribe, octopusPresentation.getSnapshot, octopusPresentation.getSnapshot);
  const focusMode = puzzle.phase !== "exploration" || octopusPuzzle.phase !== "exploration";
  const [progress] = useState(() => createExplorationProgress(depthState, encounter, presentation, undefined, [{ id: octopusEncounter.id, encounter: octopus, presentation: octopusPresentation }]));
  const saved = useSyncExternalStore(progress.subscribe, progress.getSnapshot, progress.getSnapshot);
  const traveling = saved.travelPhase !== "idle";
  useEffect(() => {
    progress.prepare(browserProgressStorage());
    const disconnect = progress.connectEncounter();
    const hidden = () => { if (document.visibilityState === "hidden") progress.flush(); };
    window.addEventListener("pagehide", progress.flush);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      progress.flush();
      disconnect();
      window.removeEventListener("pagehide", progress.flush);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [progress]);
  useEffect(() => presentation.connect(), [presentation]);
  useEffect(() => octopusPresentation.connect(), [octopusPresentation]);
  const [preferences, setPreferences] = usePreferences();
  const { failed: audioFailed, start: startAmbience } = useAmbience(preferences.volume, preferences.muted);
  const color = whaleColors.find(color => color.value === preferences.color) ?? whaleColors[0];
  useEffect(() => {
    if (gameStarted && !traveling) (gameplay.current?.querySelector("canvas") ?? gameplay.current)?.focus({ preventScroll: true });
  }, [gameStarted, traveling]);

  return <main className="experience" aria-label="An animated three-dimensional whale beneath a calm ocean">
    <div ref={gameplay} className="experience" tabIndex={-1} inert={!gameStarted || traveling} aria-hidden={!gameStarted || traveling}>
      <SceneBoundary><Scene input={input} color={color} depth={depth} encounter={encounter} presentation={presentation} gameStarted={gameStarted} progress={progress} octopus={octopus} octopusPresentation={octopusPresentation} /></SceneBoundary>
      <PuzzleFocus focusMode={focusMode || traveling}>
        <TouchJoystick input={input} />
        {gameStarted && !focusMode && !traveling && <DepthTravel progress={progress} onTravel={() => clearMovementInput(input.current)} />}
        <DepthOverlay depth={depth} />
        <ExperienceControls preferences={preferences} setPreferences={setPreferences} color={color} audioFailed={audioFailed} />
      </PuzzleFocus>
      <EncounterUI encounter={encounter} content={fishEncounter.content} presentation={presentation} />
      <OctopusUI encounter={octopus} presentation={octopusPresentation} />
    </div>
    <TravelFade progress={progress} />
    {!gameStarted && <WelcomeOverlay leaving={startPhase === "starting"}
      onStart={() => {
        startAmbience();
        setStartPhase("starting");
      }}
      onExited={() => setStartPhase("playing")} />}
  </main>;
}

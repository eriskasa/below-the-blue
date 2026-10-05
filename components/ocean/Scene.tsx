"use client";

import { Suspense, useRef, useSyncExternalStore } from "react";
import type { RefObject } from "react";
import type { MovementInput } from "./movementInput";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PerformanceMonitor, useProgress } from "@react-three/drei";
import { NoToneMapping } from "three";
import { Environment } from "./Environment";
import { Whale } from "./Whale";
import { useSwimMotion, swimSettings } from "./SwimMotion";
import { Camera } from "./Camera";
import { WaterInteraction } from "./WaterInteraction";
import { SwimInteraction } from "./SwimInteraction";
import { advanceWaves, createWaveState } from "./waves";
import type { WhaleColor } from "./ui/preferences";
import type { DepthState } from "./depth";
import { DepthTracker } from "./DepthTracker";
import { FishSchool } from "./encounters/FishSchool";
import type { PuzzlePresentation } from "./encounters/puzzlePresentation";
import type { FishEncounterSession } from "./encounters/fishEncounter";
import { OctopusSchool } from "./encounters/OctopusSchool";
import { avoidOctopus } from "./encounters/octopusEncounter";
import type { OctopusEncounterSession } from "./encounters/octopusEncounter";
import type { SwimSteering } from "./swimBehavior";
import { avoidFishSchool } from "./encounters/fishEncounter";

import type { ExplorationProgress } from "./progress/explorationProgress";
import { ProgressTracker } from "./progress/ProgressTracker";

const avoidCreatures: SwimSteering = (position, velocity) => { avoidFishSchool(position, velocity); avoidOctopus(position, velocity); };

export default function Scene({ input, color, depth, encounter, presentation, gameStarted, progress, octopus, octopusPresentation }: { input: RefObject<MovementInput>; color: WhaleColor; depth: RefObject<DepthState>; encounter: FishEncounterSession; presentation: PuzzlePresentation; gameStarted: boolean; progress: ExplorationProgress; octopus: OctopusEncounterSession; octopusPresentation: PuzzlePresentation }) {
  const { active } = useProgress();
  return <><Canvas dpr={[1, 1.5]} camera={{ position: [0, 1.1, 60], fov: 22, near: .1, far: 250 }}
    gl={{ antialias: true, alpha: false, powerPreference: "high-performance", toneMapping: NoToneMapping }}
    onCreated={({ gl }) => {
      gl.domElement.tabIndex = 0;
      gl.domElement.setAttribute("aria-label", "Ocean. Use arrow keys or WASD to swim, or drag the touch joystick.");
      if (gameStarted) gl.domElement.focus({ preventScroll: true });
    }}
    fallback={<p className="scene-status">This experience requires WebGL.</p>}>
    <World input={input} color={color} depth={depth} encounter={encounter} presentation={presentation} gameStarted={gameStarted} progress={progress} octopus={octopus} octopusPresentation={octopusPresentation} />
    <AdaptiveQuality />
  </Canvas>{active && <p className="scene-status" role="status">Entering the blue…</p>}</>;
}


function World({ input, color, depth, encounter, presentation, gameStarted, progress, octopus, octopusPresentation }: { input: RefObject<MovementInput>; color: WhaleColor; depth: RefObject<DepthState>; encounter: FishEncounterSession; presentation: PuzzlePresentation; gameStarted: boolean; progress: ExplorationProgress; octopus: OctopusEncounterSession; octopusPresentation: PuzzlePresentation }) {
  const water = useRef(createWaveState());
  const puzzle = useSyncExternalStore(presentation.subscribe, presentation.getSnapshot, presentation.getSnapshot);
  const octopusPuzzle = useSyncExternalStore(octopusPresentation.subscribe, octopusPresentation.getSnapshot, octopusPresentation.getSnapshot);
  const saved = useSyncExternalStore(progress.subscribe, progress.getSnapshot, progress.getSnapshot);
  const exploring = gameStarted && saved.ready && saved.travelPhase === "idle" && puzzle.phase === "exploration" && octopusPuzzle.phase === "exploration";
  const motion = useSwimMotion(swimSettings, water, avoidCreatures, exploring);
  useFrame((_, delta) => advanceWaves(water.current, delta, Math.random, motion.current.worldOffset), -3);
  return <>
    <ProgressTracker progress={progress} motion={motion} input={input} exploring={exploring} />
    <Camera motion={motion} />
    <DepthTracker motion={motion} depth={depth} />
    <Environment motion={motion} water={water} />
    {exploring && <SwimInteraction motion={motion} input={input} />}
    {gameStarted && <FishSchool encounter={encounter} motion={motion} input={input} presentation={presentation} />}
    {gameStarted && <OctopusSchool encounter={octopus} motion={motion} input={input} presentation={octopusPresentation} exploring={exploring} />}
    <Suspense fallback={null}>
      <Whale motion={motion} water={water} color={color} />
      <WaterInteraction motion={motion} water={water} />
    </Suspense>
  </>;
}

function AdaptiveQuality() {
  const setDpr = useThree((state) => state.setDpr);
  return <PerformanceMonitor flipflops={3}
    onChange={({ factor }) => setDpr(Math.min(window.devicePixelRatio, 1.5) * (.65 + factor * .35))}
    onFallback={() => setDpr(1)} />;
}

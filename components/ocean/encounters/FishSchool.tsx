import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import type { RefObject } from "react";
import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { Color, Euler, MathUtils, Quaternion, Vector3 } from "three";
import type { Group, MeshBasicMaterial } from "three";
import type { SwimMotion } from "../SwimMotion";
import { clearMovementInput } from "../movementInput";
import type { MovementInput } from "../movementInput";
import { setSwimInput } from "../swimBehavior";
import { fishEncounter } from "./fishEncounter";
import type { FishEncounterSession } from "./fishEncounter";
import { encounterDistance } from "./encounterAvoidance";
import { EncounterInvitation } from "./EncounterUI";
import { puzzleTransitionProgress } from "./puzzlePresentation";
import type { PuzzlePresentation } from "./puzzlePresentation";
import { puzzleObjectPosition, puzzleObjectScale } from "./puzzleFraming";
import styles from "./FishSchool.module.css";
import { PuzzleSurface } from "../ui/PuzzleSurface";

export function FishSchool({ encounter, motion, input, presentation }: {
  encounter: FishEncounterSession;
  motion: SwimMotion;
  input: RefObject<MovementInput>;
  presentation: PuzzlePresentation;
}) {
  const gl = useThree(state => state.gl);
  const { phase } = useSyncExternalStore(presentation.subscribe, presentation.getSnapshot, presentation.getSnapshot);
  const wasLocked = useRef(false);
  const invitation = useRef<Group>(null);
  useFrame(() => {
    if (phase === "exploration") encounter.proximity(encounterDistance(motion.current.worldPosition, fishEncounter.position));
    if (invitation.current) invitation.current.position.set(fishEncounter.position.x - motion.current.worldOffset, fishEncounter.position.y + 2.2, fishEncounter.position.z);
  });

  useEffect(() => {
    const locked = phase !== "exploration";
    gl.domElement.toggleAttribute("inert", locked);
    if (locked || wasLocked.current) {
      clearMovementInput(input.current);
      setSwimInput(motion.current, 0, 0);
      motion.current.velocity.set(0, 0, 0);
    }
    if (wasLocked.current && !locked) gl.domElement.focus({ preventScroll: true });
    wasLocked.current = locked;
  }, [phase, gl, input, motion]);

  useEffect(() => () => {
    encounter.leave();
    clearMovementInput(input.current);
    gl.domElement.removeAttribute("inert");
    if (wasLocked.current) setSwimInput(motion.current, 0, 0);
  }, [encounter, input, motion, gl]);

  return <group>
    {Array.from({ length: fishEncounter.fishCount }, (_, index) =>
      <EncounterFish key={index} index={index} encounter={encounter} motion={motion} presentation={presentation} />
    )}
    {phase !== "exploration" && <PuzzleSurface presentation={presentation} />}
    {phase === "exploration" && <group ref={invitation} position={[fishEncounter.position.x - motion.current.worldOffset, fishEncounter.position.y + 2.2, fishEncounter.position.z]}>
      <Html center zIndexRange={[3, 2]} style={{ pointerEvents: "none" }}>
        <EncounterInvitation encounter={encounter} content={fishEncounter.content} />
      </Html>
    </group>}
  </group>;
}

function EncounterFish({ index, encounter, motion, presentation }: {
  index: number;
  encounter: FishEncounterSession;
  motion: SwimMotion;
  presentation: PuzzlePresentation;
}) {
  const state = useSyncExternalStore(encounter.subscribe, encounter.getSnapshot, encounter.getSnapshot);
  const puzzle = useSyncExternalStore(presentation.subscribe, presentation.getSnapshot, presentation.getSnapshot);
  const group = useRef<Group>(null);
  const body = useRef<MeshBasicMaterial>(null);
  const tail = useRef<MeshBasicMaterial>(null);
  const halo = useRef<MeshBasicMaterial>(null);
  const button = useRef<HTMLButtonElement>(null);
  const animation = useRef({ stage: state.stage, phase: puzzle.phase, time: 0, elapsed: 0, glow: 0,
    from: new Vector3(), fromScale: 1, fromRotation: new Quaternion() });
  const geometry = useMemo(() => ({ target: new Vector3(), rotation: new Quaternion(), angles: new Euler() }), []);
  const colors = useMemo(() => ({ idle: new Color(["#73b9bd", "#9bbbcf", "#a5cbb7"][index]), lit: new Color("#e0fff0") }), [index]);

  useFrame(({ camera, size }, delta) => {
    if (!group.current || !body.current || !tail.current || !halo.current) return;
    const current = encounter.getSnapshot();
    const transition = presentation.getSnapshot();
    const frame = animation.current;
    if (frame.stage !== current.stage) { frame.stage = current.stage; frame.elapsed = 0; }
    if (frame.phase !== transition.phase) {
      frame.phase = transition.phase;
      frame.from.copy(group.current.position);
      frame.fromScale = group.current.scale.x;
      frame.fromRotation.copy(group.current.quaternion);
    }
    const dt = Math.min(delta, .05);
    frame.elapsed += dt;
    frame.time += dt;
    const t = frame.time;
    const celebrating = current.stage === "celebration" || current.stage === "message";
    const glow = celebrating || current.highlightedFish === index ? 1 : current.stage === "idle" ? .04 : .18;
    frame.glow = MathUtils.damp(frame.glow, glow, 7, dt);
    body.current.color.copy(colors.idle).lerp(colors.lit, frame.glow);
    tail.current.color.copy(body.current.color);
    halo.current.opacity = frame.glow * .16;

    const { target, rotation, angles } = geometry;
    target.set(fishEncounter.position.x - motion.current.worldOffset + (index - 1) * 1.9,
      fishEncounter.position.y + Math.sin(t * .7 + index) * .45, fishEncounter.position.z);
    rotation.setFromEuler(angles.set(0, 0, Math.sin(t * .8 + index) * .035));
    let scale = 1;
    if (transition.phase === "entering" || transition.phase === "active") {
      const area = presentation.getArea()?.getBoundingClientRect();
      if (!area?.width || !area.height) return;
      camera.updateMatrixWorld();
      const point = area.height < 160 ? { x: (index - 1) * .32, y: 0 } : fishEncounter.formation[index];
      puzzleObjectPosition(target, camera, size, area, point);
      rotation.copy(camera.quaternion);
      const width = Math.max(56, Math.min(112, area.width * .28, area.height * .4));
      scale = puzzleObjectScale(camera, size, width, 1.85) * (celebrating ? 1 + Math.sin(frame.elapsed * 2) * .035 : 1);
      if (button.current) button.current.style.width = `${Math.max(64, width)}px`;
    }
    if (transition.phase === "entering" || transition.phase === "leaving") {
      const progress = puzzleTransitionProgress(transition, performance.now());
      group.current.position.lerpVectors(frame.from, target, progress);
      group.current.scale.setScalar(MathUtils.lerp(frame.fromScale, scale, progress));
      group.current.quaternion.slerpQuaternions(frame.fromRotation, rotation, progress);
    } else {
      group.current.position.copy(target);
      group.current.scale.setScalar(scale);
      group.current.quaternion.copy(rotation);
    }
    group.current.children[1].rotation.y = Math.sin(t * 3 + index) * .3;
  });

  const targetLayer = presentation.getTargets();
  return <group ref={group} position={[fishEncounter.position.x + (index - 1) * 1.9, fishEncounter.position.y, fishEncounter.position.z]}>
    <mesh scale={[.8, .3, .22]}><sphereGeometry args={[1, 16, 10]} /><meshBasicMaterial ref={body} color={colors.idle} /></mesh>
    <group position={[-.72, 0, 0]}><mesh rotation={[0, 0, -Math.PI / 2]} scale={[.35, .5, .15]}>
      <coneGeometry args={[1, 1, 3]} /><meshBasicMaterial ref={tail} color={colors.idle} />
    </mesh></group>
    <mesh position={[.36, .09, .2]}><sphereGeometry args={[.045, 8, 6]} /><meshBasicMaterial color="#163b50" /></mesh>
    <mesh scale={[1.08, .5, .28]}><sphereGeometry args={[1, 16, 10]} /><meshBasicMaterial ref={halo} color="#d5fff0" transparent opacity={0} depthWrite={false} /></mesh>
    {(puzzle.phase === "active" || puzzle.phase === "leaving") && <Html center
      portal={targetLayer ? { current: targetLayer } : undefined}
      zIndexRange={[2, 1]} style={{ pointerEvents: "none" }}>
      <button ref={button} type="button" data-encounter-fish className={styles.fishTarget} aria-label={`Select fish ${index + 1}`}
        disabled={puzzle.phase !== "active" || state.stage !== "repeat" || state.highlightedFish !== null}
        onPointerDown={event => event.stopPropagation()} onClick={() => encounter.selectFish(index)}>
        <span aria-hidden="true">{index + 1}</span>
      </button>
    </Html>}
  </group>;
}

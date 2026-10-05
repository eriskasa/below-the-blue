import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import type { RefObject } from "react";
import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { CatmullRomCurve3, Color, Quaternion, Vector3 } from "three";
import type { Camera, Group, MeshBasicMaterial, Object3D } from "three";
import type { SwimMotion } from "../SwimMotion";
import { setSwimInput } from "../swimBehavior";
import { clearMovementInput } from "../movementInput";
import type { MovementInput } from "../movementInput";
import { EncounterInvitation } from "./EncounterUI";
import { encounterDistance } from "./encounterAvoidance";
import { octopusEncounter } from "./octopusEncounter";
import type { OctopusEncounterSession } from "./octopusEncounter";
import { puzzleTransitionProgress } from "./puzzlePresentation";
import type { PuzzlePresentation } from "./puzzlePresentation";
import { puzzleObjectPosition, puzzleObjectScale } from "./puzzleFraming";
import { PuzzleSurface } from "../ui/PuzzleSurface";
import { PatternPearls } from "./PatternPearls";

function invitationPosition(object: Object3D, camera: Camera, size: { width: number; height: number }) {
  const point = new Vector3().setFromMatrixPosition(object.matrixWorld).project(camera);
  const margin = Math.min(230, size.width * .66) / 2 + 16;
  return [Math.max(margin, Math.min(size.width - margin, (point.x + 1) * size.width / 2)),
    Math.max(80, Math.min(size.height - 80, (1 - point.y) * size.height / 2))];
}

export function OctopusSchool({ encounter, presentation, motion, input, exploring }: {
  encounter: OctopusEncounterSession; presentation: PuzzlePresentation; motion: SwimMotion; input: RefObject<MovementInput>; exploring: boolean;
}) {
  const { phase } = useSyncExternalStore(presentation.subscribe, presentation.getSnapshot, presentation.getSnapshot);
  const group = useRef<Group>(null), invitation = useRef<Group>(null);
  const reduced = useRef(false), wasLocked = useRef(false);
  const gl = useThree(state => state.gl);
  const frame = useRef({ phase, time: 0, from: new Vector3(), rotation: new Quaternion(), scale: 1 });
  const target = useMemo(() => new Vector3(), []);
  const rotation = useMemo(() => new Quaternion(), []);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => { reduced.current = query.matches; };
    sync(); query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    const locked = phase !== "exploration";
    gl.domElement.toggleAttribute("inert", locked);
    if (locked || wasLocked.current) {
      clearMovementInput(input.current); setSwimInput(motion.current, 0, 0); motion.current.velocity.set(0, 0, 0);
    }
    if (wasLocked.current && !locked) gl.domElement.focus({ preventScroll: true });
    wasLocked.current = locked;
  }, [phase, gl, input, motion]);
  useEffect(() => () => encounter.leave(), [encounter]);
  useFrame(({ camera, size }, delta) => {
    if (!group.current) return;
    const state = frame.current;
    state.time += Math.min(delta, .05);
    if (exploring) encounter.proximity(encounterDistance(motion.current.worldPosition, octopusEncounter.position));
    if (state.phase !== phase) {
      state.phase = phase; state.from.copy(group.current.position); state.rotation.copy(group.current.quaternion); state.scale = group.current.scale.x;
    }
    target.set(octopusEncounter.position.x - motion.current.worldOffset, octopusEncounter.position.y + (reduced.current ? 0 : Math.sin(state.time * .7) * .12), octopusEncounter.position.z);
    if (invitation.current) invitation.current.position.set(target.x + 2.8, octopusEncounter.position.y + 3.2, target.z);
    rotation.identity();
    let scale = 1;
    if (phase === "entering" || phase === "active") {
      const area = presentation.getArea()?.getBoundingClientRect();
      if (!area?.height) return;
      camera.updateMatrixWorld();
      puzzleObjectPosition(target, camera, size, area, { x: 0, y: -.31 });
      rotation.copy(camera.quaternion);
      scale = puzzleObjectScale(camera, size, Math.min(80, area.height * .4), 3);
    }
    const progress = reduced.current ? 1 : puzzleTransitionProgress(presentation.getSnapshot(), performance.now());
    if (phase === "entering" || phase === "leaving") {
      group.current.position.lerpVectors(state.from, target, progress);
      group.current.quaternion.slerpQuaternions(state.rotation, rotation, progress);
      group.current.scale.setScalar(state.scale + (scale - state.scale) * progress);
    } else {
      group.current.position.copy(target); group.current.quaternion.copy(rotation); group.current.scale.setScalar(scale);
    }
  });
  return <>
    <group ref={group} position={[octopusEncounter.position.x, octopusEncounter.position.y, octopusEncounter.position.z]}>
      <OctopusModel encounter={encounter} reduced={reduced} />
    </group>
    {phase === "exploration" && <group ref={invitation}>
      <Html center calculatePosition={invitationPosition} zIndexRange={[3, 2]} style={{ pointerEvents: "none" }}>
        <EncounterInvitation encounter={encounter} content={octopusEncounter.content} showDescription />
      </Html>
    </group>}
    {phase !== "exploration" && <><PuzzleSurface presentation={presentation} /><PatternPearls encounter={encounter} presentation={presentation} reduced={reduced} /></>}
  </>;
}

function OctopusModel({ encounter, reduced }: { encounter: OctopusEncounterSession; reduced: RefObject<boolean> }) {
  const host = useRef<Group>(null), arms = useRef<Group>(null), body = useRef<MeshBasicMaterial>(null);
  const colors = useMemo(() => ({ base: new Color("#b18ac5"), happy: new Color("#efd0dc") }), []);
  const tentacles = useMemo(() => Array.from({ length: 8 }, (_, index) => {
    const x = (index - 3.5) * .25, side = x < 0 ? -1 : 1;
    return new CatmullRomCurve3([new Vector3(x, -.25, 0), new Vector3(x * 1.3, -.8, .1), new Vector3(x * 1.55, -1.15, .2), new Vector3(x * 1.55 + side * .18, -.9, .25)]);
  }), []);
  const elapsed = useRef(0);
  useFrame((_, delta) => {
    if (!host.current || !arms.current || !body.current) return;
    elapsed.current += Math.min(delta, .05);
    const state = encounter.getSnapshot();
    const happy = state.stage === "celebration" || state.stage === "message";
    const t = elapsed.current;
    host.current.rotation.z = reduced.current ? 0 : Math.sin(t * (state.stage === "retry" ? 6 : 1.2)) * (state.stage === "retry" ? .07 : .025);
    arms.current.children.forEach((arm, i) => { arm.rotation.z = reduced.current ? 0 : Math.sin(t * (happy ? 3 : 1) + i) * (happy ? .09 : .025); });
    body.current.color.copy(colors.base).lerp(colors.happy, happy ? .35 : 0);
  });
  return <group ref={host}>
    <group ref={arms}>{tentacles.map((curve, index) => <mesh key={index}>
      <tubeGeometry args={[curve, 10, .13, 6, false]} /><meshBasicMaterial color={index % 2 ? "#bd8cc2" : "#cb98ba"} />
    </mesh>)}</group>
    <mesh position={[0, .3, 0]} scale={[.85, .95, .5]}><sphereGeometry args={[1, 20, 14]} /><meshBasicMaterial ref={body} color={colors.base} /></mesh>
    {[-1, 1].map(side => <group key={side} position={[side * .32, .35, .45]}>
      <mesh><sphereGeometry args={[.24, 12, 10]} /><meshBasicMaterial color="#f5ede7" /></mesh>
      <mesh position={[side * -.03, -.025, .21]}><sphereGeometry args={[.115, 12, 8]} /><meshBasicMaterial color="#173248" /></mesh>
      <mesh position={[-.025, .025, .3]}><sphereGeometry args={[.035, 8, 6]} /><meshBasicMaterial color="#ffffff" /></mesh>
    </group>)}
  </group>;
}

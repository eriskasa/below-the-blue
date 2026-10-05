import { useMemo, useRef, useSyncExternalStore } from "react";
import type { RefObject } from "react";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Color, Vector3 } from "three";
import type { Group, MeshBasicMaterial } from "three";
import { patternRounds, pearlColors } from "./octopusEncounter";
import type { OctopusEncounterSession, PearlColor } from "./octopusEncounter";
import type { PuzzlePresentation } from "./puzzlePresentation";
import { puzzleObjectPosition, puzzleObjectScale } from "./puzzleFraming";
import styles from "./PatternPuzzle.module.css";

export function PatternPearls({ encounter, presentation, reduced }: { encounter: OctopusEncounterSession; presentation: PuzzlePresentation; reduced: RefObject<boolean> }) {
  const state = useSyncExternalStore(encounter.subscribe, encounter.getSnapshot, encounter.getSnapshot);
  const round = patternRounds[state.round];
  return <>
    {[...round.sequence, null].map((color, index) => <Pearl key={`sequence-${index}`} color={color} index={index} answer={false} encounter={encounter} presentation={presentation} reduced={reduced} />)}
    {round.choices.map((color, index) => <Pearl key={`answer-${color}`} color={color} index={index} answer encounter={encounter} presentation={presentation} reduced={reduced} />)}
  </>;
}
function Pearl({ color, index, answer, encounter, presentation, reduced }: {
  color: PearlColor | null; index: number; answer: boolean; encounter: OctopusEncounterSession; presentation: PuzzlePresentation; reduced: RefObject<boolean>;
}) {
  const state = useSyncExternalStore(encounter.subscribe, encounter.getSnapshot, encounter.getSnapshot);
  const { phase } = useSyncExternalStore(presentation.subscribe, presentation.getSnapshot, presentation.getSnapshot);
  const group = useRef<Group>(null), body = useRef<MeshBasicMaterial>(null), halo = useRef<MeshBasicMaterial>(null), shine = useRef<MeshBasicMaterial>(null);
  const target = useMemo(() => new Vector3(), []), missing = useMemo(() => new Vector3(), []);
  const base = useMemo(() => new Color(color ? pearlColors[color] : "#9dc4d5"), [color]);
  useFrame(({ camera, size }) => {
    const areaElement = presentation.getArea(), area = areaElement?.getBoundingClientRect();
    if (!group.current || !body.current || !halo.current || !area?.height) return;
    const current = encounter.getSnapshot(), round = patternRounds[current.round];
    const correct = current.stage === "celebration" || current.stage === "message";
    const count = round.sequence.length + 1;
    const spacing = Math.min(54, (area.width - 32) / (count - 1));
    const sequencePoint = (i: number) => ({ x: (i - (count - 1) / 2) * spacing / area.width, y: .02 });
    const point = answer ? { x: (index - 1) * .28, y: area.height < 160 ? .30 : .33 } : sequencePoint(index);
    camera.updateMatrixWorld();
    puzzleObjectPosition(target, camera, size, area, point);
    const elapsed = Math.max(0, performance.now() - current.answeredAt);
    const filling = answer && correct && color === current.selected;
    if (filling) {
      puzzleObjectPosition(missing, camera, size, area, sequencePoint(count - 1));
      target.lerp(missing, reduced.current ? 1 : Math.min(1, elapsed / 600));
    }
    if (correct && current.round === 2 && !reduced.current) {
      // One quiet bob as the final pattern settles, rather than a looping celebration.
      target.setY(target.y + Math.sin(Math.min(1, elapsed / 2000) * Math.PI * 2) * .04);
    }
    group.current.position.copy(target); group.current.quaternion.copy(camera.quaternion);
    group.current.visible = color !== null || !correct;
    const diameter = answer ? 30 : Math.min(28, spacing * .65);
    group.current.scale.setScalar(puzzleObjectScale(camera, size, diameter, 2));
    const opacity = areaElement?.parentElement ? Number(getComputedStyle(areaElement.parentElement).opacity) : 1;
    body.current.opacity = opacity;
    if (shine.current) shine.current.opacity = opacity * .7;
    body.current.color.copy(base).multiplyScalar(correct ? 1.15 : 1);
    halo.current.opacity = opacity * (correct ? .24 : .10);
  });
  const targetLayer = presentation.getTargets();
  const ready = phase === "active" && state.stage === "repeat";
  return <group ref={group}>
    <mesh>{color ? <sphereGeometry args={[1, 16, 12]} /> : <torusGeometry args={[.9, .065, 6, 24]} />}<meshBasicMaterial ref={body} color={base} transparent /></mesh>
    {color && <mesh position={[-.28, .3, .88]} scale={[.22, .16, .06]}><sphereGeometry args={[1, 8, 6]} /><meshBasicMaterial ref={shine} color="#f0fffb" transparent opacity={.7} /></mesh>}
    <mesh scale={1.35}><sphereGeometry args={[1, 16, 10]} /><meshBasicMaterial ref={halo} color={base} transparent opacity={.1} depthWrite={false} /></mesh>
    {(answer || (color === null && state.stage !== "celebration" && state.stage !== "message")) && phase === "active" && <Html center portal={targetLayer ? { current: targetLayer } : undefined} zIndexRange={[2, 1]} style={{ pointerEvents: "none" }}>
      {answer && color ? <button type="button" className={styles.pearl} data-pattern-choice aria-label={`Choose ${color}`} disabled={!ready} autoFocus={index === 0}
        onPointerDown={event => event.stopPropagation()} onClick={() => encounter.choose(color)}>
        <span>{color}</span>
      </button> : <span className={styles.missing} aria-hidden="true">?</span>}
    </Html>}
  </group>;
}

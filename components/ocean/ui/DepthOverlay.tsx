"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { depthZones, smoothDepthProgress } from "../depth";
import type { DepthState } from "../depth";
import styles from "./DepthOverlay.module.css";

export function DepthOverlay({ depth }: { depth: RefObject<DepthState> }) {
  const readout = useRef<HTMLDivElement>(null);
  const meters = useRef<HTMLSpanElement>(null);
  const zone = useRef<HTMLSpanElement>(null);
  const title = useRef<HTMLDivElement>(null);
  const titleName = useRef<HTMLSpanElement>(null);
  const titleDepth = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let frame = 0;
    let lastMeters = -1;
    let lastZone = "";
    let lastDiscovery = 0;
    let animation: Animation | undefined;
    const update = () => {
      const state = depth.current;
      const value = Math.floor(state.currentDepth);
      // Update only this small DOM overlay; swimming never re-renders the scene.
      if (value !== lastMeters && meters.current && readout.current) {
        meters.current.textContent = `↓ ${value} m`;
        readout.current.style.opacity = String(.65 * smoothDepthProgress(state.currentDepth, 0, depthZones[0].maxDepth));
        lastMeters = value;
      }
      if (state.currentZone.id !== lastZone && zone.current) {
        zone.current.textContent = state.currentZone.name;
        lastZone = state.currentZone.id;
      }
      const discovery = state.discovery;
      if (discovery && discovery.sequence !== lastDiscovery && title.current && titleName.current && titleDepth.current) {
        titleName.current.textContent = discovery.zone.name;
        titleDepth.current.textContent = `${Math.floor(discovery.depth)} m`;
        animation?.cancel();
        animation = title.current.animate([
          { opacity: 0, offset: 0 },
          { opacity: .8, offset: .22 },
          { opacity: .8, offset: .65 },
          { opacity: 0, offset: 1 },
        ], { duration: 4200, easing: "ease-in-out" });
        lastDiscovery = discovery.sequence;
      }
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => { cancelAnimationFrame(frame); animation?.cancel(); };
  }, [depth]);

  return <>
    <div className={styles.readoutArea}>
      <div ref={readout} className={styles.readout} aria-label="Current ocean depth">
        <span ref={meters} className={styles.meters}>↓ 0 m</span>
        <span ref={zone} className={styles.zone}>Surface</span>
      </div>
    </div>
    <div className={styles.discoveryArea} aria-live="polite" aria-atomic="true">
      <div ref={title} className={styles.discovery}>
        <span ref={titleName} className={styles.title} />
        <span ref={titleDepth} className={styles.titleDepth} />
      </div>
    </div>
  </>;
}

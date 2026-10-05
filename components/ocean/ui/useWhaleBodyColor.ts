import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, Mesh, ShaderMaterial } from "three";
import type { Group } from "three";
import type { WhaleColor } from "./preferences";

export function useWhaleBodyColor(model: Group, color: WhaleColor) {
  const elapsed = useRef(.5);
  const transition = useMemo(() => {
    const colors: { body: Color; surface: Color; fromBody: Color; fromSurface: Color }[] = [];
    model.traverse(child => {
      if (!(child instanceof Mesh)) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) {
        if (!(material instanceof ShaderMaterial)) continue;
        const body: unknown = material.uniforms.uPurple?.value;
        const surface: unknown = material.uniforms.uTail?.value;
        if (body instanceof Color && surface instanceof Color) {
          colors.push({ body, surface, fromBody: body.clone(), fromSurface: surface.clone() });
        }
      }
    });
    return { colors, body: new Color(), surface: new Color() };
  }, [model]);

  useEffect(() => {
    for (const entry of transition.colors) {
      entry.fromBody.copy(entry.body);
      entry.fromSurface.copy(entry.surface);
    }
    transition.body.set(color.value);
    transition.surface.set(color.surface);
    elapsed.current = 0;
  }, [color, transition]);

  useFrame((_, delta) => {
    if (elapsed.current >= .5) return;
    elapsed.current = Math.min(.5, elapsed.current + delta);
    const progress = elapsed.current / .5;
    const eased = progress * progress * (3 - 2 * progress);
    for (const entry of transition.colors) {
      // Only the existing body tint uniforms change; eyes and shader code stay intact.
      entry.body.lerpColors(entry.fromBody, transition.body, eased);
      entry.surface.lerpColors(entry.fromSurface, transition.surface, eased);
    }
  });
}

"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent, RefObject } from "react";
import { joystickMovement, joystickRadius, setTouchMovement } from "./movementInput";
import type { MovementInput } from "./movementInput";

export function TouchJoystick({ input }: { input: RefObject<MovementInput> }) {
  const pointer = useRef<{ id: number; x: number; y: number } | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0, active: false });

  useEffect(() => {
    const state = input.current;
    const reset = () => {
      if (!pointer.current) return;
      pointer.current = null;
      setTouchMovement(state, 0, 0);
      setKnob({ x: 0, y: 0, active: false });
    };
    const onVisibility = () => { if (document.hidden) reset(); };
    window.addEventListener("blur", reset);
    window.addEventListener("resize", reset);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      setTouchMovement(state, 0, 0);
      window.removeEventListener("blur", reset);
      window.removeEventListener("resize", reset);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [input]);

  const move = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = pointer.current;
    if (!drag || drag.id !== event.pointerId) return;
    const direction = joystickMovement(event.clientX - drag.x, event.clientY - drag.y);
    setTouchMovement(input.current, direction.x, direction.y);
    setKnob({ x: direction.x * joystickRadius, y: -direction.y * joystickRadius, active: true });
  };
  const release = (event: PointerEvent<HTMLButtonElement>) => {
    if (pointer.current?.id !== event.pointerId) return;
    pointer.current = null;
    setTouchMovement(input.current, 0, 0);
    setKnob({ x: 0, y: 0, active: false });
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return <button type="button" className="touch-joystick" data-active={knob.active} data-movement-control
    aria-label="Movement joystick. Drag to swim, or use arrow keys or WASD when focused."
    onPointerDown={event => {
      if (pointer.current || event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      const rect = event.currentTarget.getBoundingClientRect();
      pointer.current = { id: event.pointerId, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      event.currentTarget.setPointerCapture(event.pointerId);
      move(event);
    }}
    onPointerMove={move} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}>
    <span className="touch-joystick-knob" aria-hidden="true" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
  </button>;
}

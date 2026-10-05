"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import styles from "./PuzzleFocus.module.css";

// Wrap only exploration UI. Puzzle creatures, Hint and Close remain outside.
export function PuzzleFocus({ focusMode, children }: { focusMode: boolean; children: ReactNode }) {
  const capturedPointer = useRef<{ element: Element; id: number } | null>(null);

  useEffect(() => {
    if (!focusMode) return;
    // A finger may already be holding the joystick when another presses Play.
    // Release capture through its existing lost-capture handler before hiding it.
    const capture = capturedPointer.current;
    if (capture?.element.hasPointerCapture(capture.id)) capture.element.releasePointerCapture(capture.id);
    capturedPointer.current = null;
  }, [focusMode]);

  return <>
    <div className={styles.ambientUI} data-focused={focusMode} inert={focusMode} aria-hidden={focusMode}
      onGotPointerCaptureCapture={event => {
        if (event.target instanceof Element) capturedPointer.current = { element: event.target, id: event.pointerId };
      }}
      onLostPointerCaptureCapture={event => {
        if (capturedPointer.current?.id === event.pointerId) capturedPointer.current = null;
      }}>
      {children}
    </div>
    <div className={styles.vignette} data-focused={focusMode} aria-hidden="true" />
  </>;
}

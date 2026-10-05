export function createMovementInput() {
  return { keys: new Set<string>(), touchX: 0, touchY: 0, x: 0, y: 0, revision: 0 };
}
export type MovementInput = ReturnType<typeof createMovementInput>;

const movementKeys = new Set(["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"]);

function updateInput(input: MovementInput) {
  const right = input.keys.has("arrowright") || input.keys.has("d");
  const left = input.keys.has("arrowleft") || input.keys.has("a");
  const up = input.keys.has("arrowup") || input.keys.has("w");
  const down = input.keys.has("arrowdown") || input.keys.has("s");
  const x = Number(right) - Number(left) + input.touchX;
  const y = Number(up) - Number(down) + input.touchY;
  const length = Math.max(1, Math.hypot(x, y));
  input.x = x / length;
  input.y = y / length;
  input.revision++;
}

export function setMovementKey(input: MovementInput, key: string, pressed: boolean) {
  key = key.toLowerCase();
  if (!movementKeys.has(key)) return false;
  if (pressed === input.keys.has(key)) return true;
  if (pressed) input.keys.add(key);
  else input.keys.delete(key);
  updateInput(input);
  return true;
}

export function setTouchMovement(input: MovementInput, x: number, y: number) {
  const length = Math.max(1, Math.hypot(x, y));
  input.touchX = x / length;
  input.touchY = y / length;
  updateInput(input);
}

export function clearMovementInput(input: MovementInput) {
  input.keys.clear();
  setTouchMovement(input, 0, 0);
}

export const joystickRadius = 36;
export function joystickMovement(dx: number, dy: number) {
  const distance = Math.hypot(dx, dy);
  const strength = Math.min(1, Math.max(0, (distance / joystickRadius - .08) / .92));
  return distance === 0 ? { x: 0, y: 0 } : { x: dx / distance * strength, y: -dy / distance * strength };
}

export function bindMovementKeyboard(canvas: HTMLCanvasElement, input: MovementInput) {
  const onKeyDown = (event: KeyboardEvent) => {
    const target = event.target;
    const isJoystick = target instanceof HTMLElement && target.hasAttribute("data-movement-control");
    if (target !== canvas && target !== document.body && !isJoystick) return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (setMovementKey(input, event.key, true)) event.preventDefault();
  };
  const onKeyUp = (event: KeyboardEvent) => {
    if (!input.keys.has(event.key.toLowerCase())) return;
    setMovementKey(input, event.key, false);
    event.preventDefault();
  };
  const release = () => clearMovementInput(input);
  const onVisibility = () => { if (document.hidden) release(); };
  const onFocus = (event: FocusEvent) => {
    if (event.target instanceof HTMLElement && event.target !== canvas && !event.target.hasAttribute("data-movement-control")) release();
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", release);
  document.addEventListener("visibilitychange", onVisibility);
  document.addEventListener("focusin", onFocus);
  return () => {
    release();
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", release);
    document.removeEventListener("visibilitychange", onVisibility);
    document.removeEventListener("focusin", onFocus);
  };
}

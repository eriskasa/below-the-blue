import { headLandmark, wakeLandmark } from "../swimBehavior.ts";
import type { SwimState } from "../swimBehavior.ts";
import type { PlayerPosition } from "./progress.ts";

export function relocateWhale(state: SwimState, position: PlayerPosition) {
  state.worldPosition.set(position.x, -position.depth, .6);
  state.worldOffset = position.x;
  state.position.set(0, -position.depth, .6);
  state.velocity.set(0, 0, 0);
  state.desiredVelocity.set(0, 0, 0);
  state.input.set(0, 0);
  state.interacting = false;
  state.controlled = true;
  state.travelSpeed = 0;
  state.behavior = "cruise";
  state.head.copy(headLandmark).applyQuaternion(state.orientation).add(state.position);
  state.wake.copy(wakeLandmark).applyQuaternion(state.orientation).add(state.position);
  state.relocationRevision++;
}

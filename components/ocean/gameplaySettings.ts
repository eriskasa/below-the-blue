// Distances are scene units; acceleration/deceleration are units per second².
export const gameplaySettings = {
  normalSpeed: 5.2,
  acceleration: 24,
  deceleration: 28,
  drift: .16, // Maximum release-to-stop time, in seconds.
  horizontalWorldHalfWidth: 120,
  surfaceClearance: 1.6,
  // Fraction of the visible height below center before the camera follows.
  cameraFollowThreshold: .16,
  cameraFollowDamping: 4,
};

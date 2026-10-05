# The quiet blue

A living React Three Fiber / Three.js ocean scene in Next.js and TypeScript. The whale is the supplied GLB; scenery, movement, light, and deformation are rendered in real time. The reference image supplies art direction and is never loaded by the application.

```sh
npm install
npm run dev
```

Open http://localhost:3000. Arrow keys or WASD swim directly up/down/left/right; diagonals have the same top speed. Release to stop with a short drift. On touch devices, drag the faint bottom-left thumb control in any direction; a shorter drag swims more slowly. Click or tap the water to approach a point and stop there. The whale swims autonomously until the first movement input. Its existing swimming animation continues at rest. Surface visuals remain unchanged; the underwater background transitions through the configured depth zones.

## Animation and scene structure

`components/ocean/Scene.tsx` owns the canvas. `SwimMotion.ts` connects the render loop to `swimBehavior.ts`, which steers long cruising legs with independently timed acceleration, edge exploration, dives, rises, foreground passes, and turns. Excursions ease in and out, and direction changes decelerate through the turn. Orientation follows velocity with gentle banking, pitch, and yaw. Quaternions keep heading changes continuous.

The whale has a world position and a local rendered position. A shared travel offset follows it once it reaches the outer framing area, keeping the animal visible inside the horizontal world bounds of −120 to +120 units. Fixed landmarks subtract that offset, so rightward travel carries them left and vice versa. Cloud layers respond at a much smaller fraction of that distance, while fish and particles retain their own motion. Wake and ripple positions also subtract travel so they stay behind in the water rather than following the whale.

`movementInput.ts` combines keyboard and analog touch input into a vector of at most unit length. `SwimInteraction.tsx` applies changed input before the movement frame and raycasts clicks onto the whale's existing 2.5D plane. `TouchJoystick.tsx` captures one pointer, releases on cancellation/blur/rotation, and occupies only a 112px safe-area-aware corner on coarse-pointer devices. UI controls keep their own keys. `swimBehavior.ts` owns acceleration, braking, orientation, and world constraints; input never moves the whale directly.

Tune `gameplaySettings.ts`: `normalSpeed` = 5.2 units/second, `acceleration` = 24 and `deceleration` = 28 units/second², `drift` = .16 seconds maximum release time. The idle autonomous cruising settings and body/tail animation remain separate. Click targets are limited to a ten-unit journey and stop on arrival. World edges apply braking before a final numerical boundary guard. Player movement stays below the wave surface with 1.6 units of center clearance.

`depth.ts` is the single zone configuration: Surface 0–15m, Sunlit Waters 15–40m, Blue Depths 40–80m, Deep Ocean 80–130m, Twilight Zone 130–190m, Abyss 190–260m, Dark Abyss 260–330m, and Ocean Floor 330–350m. Each zone exposes its ID, display name, bounds, background palette, visual intensity, and future difficulty. Gameplay meters map directly to negative world Y. `verticalWorldDepth` is derived from the last zone; the existing movement braking and numerical guard enforce that floor without changing speed or controls. The single underwater backdrop extends below it to cover camera framing.

`DepthTracker` updates a shared `DepthState` after movement each frame. Future scene systems can query `depth.current.currentDepth`, `currentZone`, and `zoneDifficulty`. Visited zone IDs belong to this mounted experience, reset on reload, and never enter localStorage. `DepthOverlay` reads the same state to update a small meter and a 4.2-second discovery title without re-rendering the scene. The starting Surface zone is already visited; each deeper zone gets one title per visit session.

`depthVisuals.ts` interpolates background colors in linear RGB with quintic easing, based on camera depth. Surface colors and gradient stay exact throughout the Surface range. Each subsequent zone blends from the previous palette to its own palette by its maximum depth; all boundaries are continuous. Visual intensity scales only the backdrop's existing lighting pattern, never whale lighting. The original underwater gradient gently follows the diving camera after Surface. No fog, blur, terrain, or encounters are added.

The `encounters/` module adds an optional fish school at world X = 0, halfway through Sunlit Waters (27.5m). Its small Play invitation is anchored above the school in world space; E or Enter also chooses Play while focused on the world. Play enters centered puzzle mode and freezes movement. Instructions wait for Start, enabled after the 600ms entry, before any glow sequence. Three real Three.js fish show the same shuffled three-step order and accept mouse, touch, or keyboard selections. Hint never changes the answer or progress. Close / Escape cancel pending puzzle callbacks. First success celebrates in place and shows “The current remembers you.” Replays skip that first-completion message, and invitations rearm only after leaving and re-entering the encounter range.

At world X = 0 and 62m deep in Blue Depths, a curious octopus offers “Complete the Pattern.” Three rounds ask for the next colored pearl in a repeating sequence. The sequence stays visible; each round has its own Hint, wrong answers allow a retry, and correct answers move the selected pearl into the gap. Mouse, touch, and keyboard use the same accessible answer buttons. The octopus and pearls use procedural Three.js geometry, with reduced-motion support. Close / Escape cancel pending feedback and return to exploration through the shared puzzle presentation.

`progress/` stores position, discovered depth zones, and both encounter completion flags under `whale-exploration-progress` in localStorage. Reloading restores completed encounters with familiar replay invitations. Depth travel is unavailable during either puzzle, including its entry and return transitions; destinations keep the whale outside both creatures' invitation and collision areas.

`puzzlePresentation.ts` owns only the exploration → entering → active → leaving presentation lifecycle. `PuzzleMode` supplies a centered frame, measured creature area, instructions, Hint, Close, and keyboard focus containment. `puzzleFraming.ts` maps normalized formation points from that measured area through the existing camera projection. The same meshes interpolate from their current transforms over 600ms, stay centered through instructions, play, retry, and success, and return over 600ms before exploration unlocks. A triangle becomes a row on short landscape screens. Future encounters can use this presentation contract and supply their own creatures and rules.

The school's collision ellipse has half-sizes 3.3 × .85 units, separate from its six-unit invitation range. Steering expands it by the whale's 4.6 × 2.5-unit footprint and a .25-unit margin, with a 1.5-unit approach band and .12-unit integration cushion. It redirects only inward input near the local boundary. Water six units above/below the school remains free, and outward/tangential input is unchanged. The existing movement speed, acceleration, and integration still own the whale's motion.

`PuzzleFocus` keeps exploration controls mounted but fades them and makes them inert throughout entry, play, success, and return. It releases a held joystick pointer when Play is selected. A clear-centered ocean wash blocks background pointers without blur, canvas filters, or exploration-camera changes. The canvas is also inert while the puzzle's accessible fish targets live in the centered presentation layer. On return, controls become available and focus returns to the ocean. Welcome and ambience behavior are unchanged.

`cameraFollow.ts` supplies the vertical offset. `cameraFollowThreshold` = .16 of the visible height below center preserves the surface composition until a dive crosses that region; `cameraFollowDamping` = 4 smoothly tracks and returns toward the surface. `Camera.tsx` applies the same vertical translation to its position and look target, preserving the side view and existing horizontal composition.

Rare surfacing visits begin after roughly 38–80 seconds of uninterrupted autonomous movement, then at least 65 seconds apart. The whale lifts its head, holds briefly while still swimming, and settles back underwater. `WaterInteraction.tsx` detects the transformed head crossing the rolling water height to emit a small splash and expanding rings. Faster movement leaves a faint wake. Fixed effect pools fade and reuse their meshes rather than spawning objects each frame. Head and wake landmarks are specific to the supplied model and need adjustment if it is replaced.

The supplied GLB has one mesh, one material, 538,312 vertices, 1,000,000 triangles, and no skeleton or animation clips. `Whale.tsx` loads and normalizes it. `whaleShaders.ts` bends the original vertices on the GPU using smooth anatomical weights:

- Tail: primary sweep plus out-of-plane fluke movement.
- Body: a travelling wave, attenuated toward the face.
- Fins: independent, phase-offset flapping and sweeping on each side.
- Lighting: normals rotate with the deformation; broad shading, a soft rim, underwater tint, and moving procedural caustics preserve volume without using the texture's baked purple blotches.

Edit `swimSettings` in `swimBehavior.ts` (also exported from `SwimMotion.ts`): `swimSpeed`, `tailStrength`, `bodyWave`, `finStrength`, `verticalBob`, `turnStrength`, and `bankStrength`. Angular strengths use radians; body-wave amplitude uses the source mesh's coordinate scale; bob uses scene units.

`Environment.tsx` composes:

- `Sky`: turquoise atmosphere on distant geometry.
- `Clouds`: eleven continuous cloud meshes at different depths, independently drifting and bobbing with soft shading.
- `Ocean`: three broad directional wave layers, with irregular wider swell packets. `waves.ts` supplies matching CPU/GPU wave formulas for displacement, exact surface slopes, surfacing, and ripple placement. `oceanShaders.ts` shades the resulting normals with bounded cyan reflections and broad highlights. Swells originate around the current stretch of ocean, even after prolonged travel.
- `Fish`: five small, low-contrast fish at different depths, with separate speeds and tail beats. They re-enter outside the viewport with varied spacing and speed.
- `Island`: three sparse landmark variants (two-tree island, rock, and smaller one-tree island) at different depths. They leave the viewport naturally and recycle only well offscreen, with irregular spacing and empty stretches of horizon.
- `Underwater`: drifting foreground/background particles, depth color, a slowly moving cyan light field, and subtle procedural lighting patterns.
- `Lighting`: a soft ambient and directional setup. Custom shader materials compute their own broad directional illumination.

`Camera.tsx` uses a long-lens perspective camera, frame-rate-independent damping, floating motion, mouse parallax, and restrained whale tracking.

Animation updates refs, transforms, and uniforms; it does not recreate geometry/materials or update React state per frame. The DPR is bounded and adaptive. Time steps are capped to avoid jumps when resuming a background tab. The 53 MB source asset remains the main loading/GPU cost; headless software-rendering tests do not establish mobile hardware performance.

## Tuning the ocean surface

Edit `oceanSettings` at the top of `components/ocean/waves.ts`, then reload. Amplitudes and wavelengths use scene units; speeds use scene units per second. The primary wave supplies most of the silhouette; keep the other amplitudes much smaller.

| Parameter | Default | Effect |
| --- | --- | --- |
| `waveAmplitude` | .18 | Primary wave height |
| `waveLength` | 48 | Primary crest spacing |
| `waveSpeed` | 1.15 | Primary travel speed |
| `secondaryAmplitude` | .05 | Quieter diagonal wave height |
| `secondaryWaveLength` | 34 | Secondary crest spacing |
| `secondarySpeed` | .72 | Secondary travel speed |
| `tertiaryAmplitude` | .014 | Very subtle organic variation |
| `swellAmplitude` | .1 | Maximum extra height of a passing swell |
| `swellWidth` | 16 | Width of the broad swell envelope |
| `swellDuration` | 25 | Approximate seconds for a swell passage |
| `roughness` | .88 | Higher values broaden the soft highlight |
| `specularStrength` | .045 | Cyan highlight contribution |
| `reflectionStrength` | .12 | Blurred turquoise sky reflection contribution |

The material uses smooth color ramps and tint-preserving blends, without crest bands, noise, foam, white environment reflections, or additive specular spikes. The surface has 16,384 quads with GPU displacement; positions and analytic normals use the same wave coefficients.

The old surface crossed the underwater box's flat cap and extended through the sky backdrop. The new surface meets the underwater front face, whose top boundary is clipped to the same wave height with antialiased coverage. It ends before the sky geometry, with fading wave amplitude and atmospheric blending near the horizon. Existing underwater colors, glow, and particles are preserved. Surface ripple masks are feathered cyan instead of hard pale rings.

Those intersections, the previous height-based crest shading, and undefined GLSL `pow` behavior at negative sine endpoints were likely artifact sources identified from code. Their contribution to the reported white patches has not been confirmed in a browser. Visual tuning of the normal camera view remains necessary.

## Replacing the whale

Replace `public/models/whale.glb` or change `asset.url` in `Whale.tsx`. Size normalization is automatic. The environment has no dependency on the whale's hierarchy.

The procedural anatomical masks in `whaleShaders.ts` are specific to this unrigged mesh's coordinates and silhouette. Adjust them for a different unrigged asset, or substitute bone animation for a rigged replacement. The bright texture mask used for eyes may also need adjustment. The source file is never modified.

## Checks

```sh
npx tsc --noEmit
npm run lint
node --experimental-strip-types --test tests/*.test.mjs
npm run build -- --webpack
```

The motion tests run seeded twenty-minute simulations at desktop and portrait movement bounds, checking smoothness, behavior coverage, rare surface contact, returns to cruising, frame-rate consistency, and background-tab recovery. World-motion tests cover near/far/repeated targets, acceleration and braking limits, opposite landmark motion in both directions, offscreen recycling, empty horizon intervals, and irregular continuous waves. Gameplay tests cover all eight keys, analog and diagonal input, release drift, click arrival, world boundaries, depth zones, and dive/return behavior. The actual camera component is checked at 1440×900, 320×568, 375×667, 390×844, 430×932, 667×375, 844×390, and 932×430. Thumb-control event tests cover pointer capture, cancellation, multiple fingers, and hidden tabs. These need Node 22.6+ with type stripping; they do not replace mobile-browser interaction checks.

These tests do not replace watching the WebGL scene for at least 60 seconds. Check left/right travel, edge framing, island disappearance, cloud parallax, rolling waves and a swell, then near/far/repeated clicks and slowing on arrival. Include portrait framing and touch input.

Webpack is used for production verification here because this environment restricts Turbopack worker-port creation.

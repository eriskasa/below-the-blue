# Below the Blue — Project Status

Last checkpoint: October 2026

## Current State

Below the Blue is a peaceful 2.5D whale exploration and puzzle game.

Core loop:

Explore → discover → approach → interact → solve puzzle → world reacts → descend deeper.

The project is currently in a stable prototype state and has been archived to a private GitHub repository.

## Working Features

- 2.5D whale movement
- Keyboard controls (WASD / arrow keys)
- Mobile analog joystick
- Smooth camera following
- Surface and underwater exploration
- Progressive depth zones
- Depth discovery and fast travel
- Persistent player progress
- Whale color selector with persistence
- Ocean ambience with mute control
- Welcome/start screen
- Fish encounter and memory puzzle
- Octopus encounter and pattern puzzle
- Responsive desktop/mobile UI

## Depth Zones

- Surface — 0–15m
- Sunlit — 15–40m
- Blue — 40–80m
- Deep — 80–130m
- Twilight — 130–190m
- Abyss — 190–260m
- Dark Abyss — 260–330m
- Floor — 330–350m

Discovered zones permanently unlock and can be used for fast travel.

## Encounters

### Fish — Sunlit Zone

Memory sequence puzzle.

Completed encounters persist but can be replayed.

### Octopus — Blue Depths

"Complete the Pattern" puzzle.

Three pattern rounds are implemented.

Success message:

> Patterns flow through everything.

Completion persists and the encounter can be replayed.

## Save System

Local storage key:

`whale-exploration-progress`

Do NOT rename this key unless intentionally migrating saved games.

It stores:

- player position
- discovered depth zones
- completed encounters

## Important Design Direction

Keep the game peaceful and minimal.

Do not add:

- combat
- health bars
- XP
- scores
- stars
- lives
- traditional quest markers
- heavy HUD elements

The environment should remain calm and mostly static unless a puzzle or discovery requires a subtle reaction.

## Visual Direction

- Stylized/cartoon 2.5D
- Purple whale
- Pastel clouds
- Turquoise/blue surface
- Deep blue underwater environments
- Sparse composition
- Minimal UI
- Relaxing atmosphere

## Assets

Current optimized assets:

- Whale model: approximately 9.2 MB
- Ocean ambience: approximately 2.6 MB

The whale model was optimized while preserving the working appearance and movement.

Avoid replacing it with the earlier aggressively simplified versions because those caused problems with the whale's flippers/body.

## Git / Repository

Repository name:

`below-the-blue`

Current clean-history checkpoint:

`2623570 Below the Blue exploration prototype`

The Git history was intentionally reset before the first GitHub push to remove old large binary assets.

Current `.git` size after cleanup was approximately 12 MB.

The GitHub repository is PRIVATE.

A local backup containing the older development history was kept separately:

`~/below-the-blue-backup`

Do not delete that backup until it is no longer wanted.

## Tech Stack

- Next.js
- React
- TypeScript
- React Three Fiber
- Three.js
- Drei
- GSAP

## Known Non-Critical Development Warnings

Development previously showed:

- THREE.Clock deprecation warning
- occasional hydration attributes caused by browser extensions
- Next.js/Turbopack warning about a package-lock file outside the repository

These were not blocking the game.

Do NOT blindly run:

`npm audit fix --force`

because forced dependency upgrades could introduce breaking changes.

## Where To Continue Later

Before adding anything new:

1. Pull/open the current `main` branch.
2. Run the game and verify the whale, fish encounter, octopus encounter, sound, saves, and depth travel.
3. Read this file and the README.
4. Continue from the stable prototype rather than rebuilding existing systems.

Possible future direction:

Continue adding peaceful discoveries and puzzle encounters in deeper zones while preserving the simple Explore → Discover → Solve → Descend structure.

---

Status at archive:

**Stable prototype. Fish + Octopus encounters working. Optimized assets. Clean Git repository. Private GitHub backup complete.**

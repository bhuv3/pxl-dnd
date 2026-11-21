# Fog of war: plan (parked)

Not being built yet. This is the design agreed so far, kept for later. The main plan (`plan.md`) links here.

## Goal

A player view where unexplored parts of the map are hidden and get revealed as the party explores, for running D&D sessions on a TV, a second screen, or a video call.

## Proposed design

1. **Separate player window.** A "Player view" button opens a second window (`window.open`) that shows only the map, with no tools. The editor window keeps the reference and sends updates with `postMessage`, which also works on `file://` (`BroadcastChannel` may not).
   - The GM's editor shows everything, with hidden areas lightly shaded so the GM knows what players can't see.
2. **Two ways to reveal:**
   - *Automatic:* walking the party character in Play mode reveals its line of sight. This reuses `Fire.visibility` (rays that stop at walls), with a vision radius setting.
   - *Manual:* a Reveal / Hide brush, plus click a room to reveal it at once (flood fill bounded by walls).
3. **Three states per pixel** (`fog: Uint8Array(w × h)`):
   - `0` never seen: black (or parchment).
   - `1` seen before: darkened and desaturated; no animals or characters drawn there.
   - `2` in view now: normal.
   - Edges use checkerboard dithering to match the pixel art.
4. **Saved with the map** as a base64 layer like `ground`, so a campaign continues between sessions. A "Reset fog" button clears it.
5. Export: a "Player view" PNG option that applies the fog.

## Open questions for the user

- Separate player window, or a toggle on the same screen?
- Reveal automatically, manually, or both?
- Should already-seen areas stay visible but dimmed, or go fully black again?

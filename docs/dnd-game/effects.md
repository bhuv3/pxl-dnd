# Effects: fight animations

Back to [overview.md](overview.md). Built first, in the effects lab ([roadmap.md](roadmap.md) Step 1).

How attacks, spells, heals, hits, and deaths look. Effects only *show* an outcome; the rules decide it ([rules.md](rules.md), [combat.md](combat.md)).

---

## 1. Two layers

Every action has two parts, played together:

1. **Pose:** the character's body. Wind-up, strike or cast, recover. The target's hit or death pose.
2. **Effect:** what flies, bursts, or glows. Projectiles, particles, rings, beams, ground marks, plus a real light (`Fire.addLight`) so spells light the room and stop at walls.

On top of both: **feel** (hit flash, knockback, shake, hit-stop) and **text** (damage numbers, MISS, dice).

## 2. Style and timing

- **Pixel art, crisp.** Effects draw in map pixels with no smoothing, like the rest of the map. No blur, no soft gradients: glows are 2–3 flat bands with checkerboard dither at the edges (same as the editor's light bands).
- **Few frames, held well.** 3–6 frames per stage. Fast actions are fast: a sword swing is about 0.3 s, a fire bolt flight about 0.4 s, a fireball about 1.2 s.
- **Hit-stop:** on impact, freeze both characters for 2–4 frames (about 60–120 ms; crits 200 ms). This sells weight more than anything else.
- **Anticipation:** every attack has a short wind-up (100–250 ms) before the strike, so the eye knows something is coming.
- **Time:** effects run on the animation clock (every display frame), not on the map's `fps` redraw. A global `timeScale` gives slow motion (0.25×) in the lab.
- **Brightness:** fire, magic, and holy light draw at full brightness after the night tint (like the editor's flames, `Fire.drawGlow`); smoke, dust, and stones are tinted like the map.
- **Readable at a glance:** each damage type has its own color family (section 9), so the player knows what hit without reading.

## 3. Poses

Characters are drawn at half size (2 character pixels per map pixel). Poses are drawn at character resolution. Built in Step 2b.

**Heroes** (`Heroes`, js/art/heroes.js) are drawn in code from an outfit on one body rig, so a pose is just numbers: the near and far arm angles, the weapon's angle, a lean of the upper body, a stride, a crouch, eyes shut when hurt. Angles are radians from straight up, positive = forward.

| Pose | What it looks like (side view) | Used by |
|---|---|---|
| `stand` | Arms down, weapon held upright | everything at rest |
| `walk` | 4 frames, the villagers' stride cycle (legs, arms, robe hem, cape swing) | later steps (exploring) |
| `windup` | Weapon arm up and back, body leaning back, back foot planted | swings, throws, monster attacks |
| `strike` | Arm thrust forward, body leaning in, front foot forward | swings, throws, jabs |
| `cast` | Both arms forward and up, staff or weapon pointing ahead | spells |
| `raise` | Weapon or holy symbol held high | Sacred Flame, Turn Undead |
| `inhale` | Leaning back, rising a pixel | fire breath |
| `hit` | Arms flung, leaning back, eyes shut | taking a blow |
| `dodge` | Leaning away, a step back | a miss |
| `down` | Kneeling, eyes shut; Deaths then lays it over | a hero at 0 HP |

- **A swing moves the real arm.** While a blade effect swings, it sets the figure's arm to the blade's angle (`f.arm`), hides the held weapon, and draws the blade and its smear turning round the shoulder beyond the hand. The pose's lean and stride still apply.
- **Front and back views** (south and north facings) only stand and walk; the lab only uses side views. Combat facing up or down will need front and back action poses later.
- **Monsters** (the editor's code-drawn families) have no attack art and the editor isn't changed, so `Poses` leans their own sprite into the pose: rows above the waist shift toward (strike, cast) or away from (windup, hit, dodge) the facing, up to 2–3 pixels at the head, feet planted.
- **Deaths** (`Deaths`): skeleton collapses into a heap of bones; goblin topples; slime squashes into a puddle; cultist sinks into the floor with a wisp of smoke; heroes kneel, then lie down (unconscious, not dead: 5e death saves; healing stands them up).
- **Facing:** an attacker turns to face the target first.

## 4. Building blocks

Every effect is built from these. Each is a small module or function in `js/fx/`.

| Block | What it does | Settings |
|---|---|---|
| `pose` | Plays a pose on a character for a time | who, pose, duration, lean |
| `projectile` | Moves a small sprite from A to B | sprite, speed or duration, arc height, spin, homing curve, trail |
| `trail` | Leaves particles behind a moving thing | rate, particle kind, life |
| `particles` | Spawns a burst or stream of particles | count, shape, colors, speed, spread, gravity, rise, life, fade |
| `ring` | An expanding circle outline or filled disc | max radius, thickness, colors, duration |
| `cone` | Fills a 5e cone with particles | length (squares), colors, density |
| `line` | Straight or jagged beam between two points | width, jag amount, flicker, duration |
| `column` | Light falling from above onto a spot | width, height, colors |
| `aura` | Outline glow or rotating motes round a character | colors, radius, duration |
| `light` | A real light pool through `Fire.addLight`, blocked by walls | color, radius, power over time (curve) |
| `mark` | A ground decal that fades (scorch, frost, acid, blood-free dust) | sprite or shape, fade time |
| `flash` | Draws a character solid white (or a color) for N frames | color, frames |
| `knockback` | Pushes a character's drawn position 1–3 px away, then back | distance, time |
| `shake` | Shakes the camera | strength (px), time |
| `hitstop` | Freezes characters and effects briefly | time |
| `screenflash` | Tints the whole frame for one frame (lightning) | color, strength |
| `popup` | Floating text in screen space: numbers, MISS, CRIT | text, color, rise, life |
| `wait` | Pauses the sequence | time |

**Particles** are single map pixels (sometimes 2×1 or 2×2), with `x, y, vx, vy, life, color list (over life), gravity, drag`. Kinds: ember, spark, mote, heal, glow, smoke, dust, drop, shard. Cap at 4000 live particles. The bright kinds (ember, spark, mote, heal, glow) are drawn last and additively (`'lighter'`), so they light up what is behind them; smoke grows as it rises; a spark leaves a short streak.

## 5. Effect catalog

Colors refer to section 9. "Light" means a `light` block with that color. Damage numbers come from the result; the effect just shows them.

### Wizard

Built in Step 7 (as built, in `js/fx/spells.js`): Ray of Frost (a fast icy bead, frost burst, SLOWED), Burning Hands (an ember cone from the hands), Thunderwave (rings and dust from the caster, BOOM, a hard shake; the push is combat's), Sleep (violet motes over the circle, ZZZ over sleepers); Guiding Bolt, Inflict Wounds, Bless, Shield of Faith for the cleric; and a hidden Shake awake. Step 7c added Acid Splash (a lobbed acid glob), Poison Spray (a green puff), Shocking Grasp (a short arc of lightning), Chill Touch (a necrotic dart), True Strike (a violet glint, SEEN), Chromatic Orb (a bead in the chosen type's colors: steps with type 'chosen'), Scorching Ray (three fire beads, each with its own number or MISS: steps with ifPart), Shatter (a white crack and stone shards), Blur (the caster fades and flickers), Misty Step (silver mist out, then mistyStepIn where they land). Conditions show as small labels over the figure (`Figures`, from `f.status`). Step 7d (the 2024 rules) changed: Sleep (violet dust on a 5 ft spot, DROWSY; ZZZ or AWAKE over it at the end of its next turn), Acid Splash (the glob bursts on a 5 ft spot), Poison Spray (a cloud flies 30 ft), Chill Touch (a dark touch, no dart), True Strike (a staff swing in the chosen type's colors: the `staff` blade), Inflict Wounds (the damage lands on a save too, with SAVE); new hidden effects `chromaticOrbLeap` (the orb flying on from the first target), `fireBreathLine` (a 30 ft jet), `goblinDagger`, `goblinThrow`. Weapons' damage types (bludgeoning, slashing, piercing) draw in `steel`. Step 7e added Mage Armor (a violet bubble, ARMOR), Mirror Image (the caster flickers; three faint copies then drift round the figure, drawn by `Figures` from `f.images`; the hidden `mirrorImageHit` bursts one into shards with IMAGE), Hold Person (a violet thread, a shrinking ring, HELD), Hypnotic Pattern (four rings and motes of fire, cold, force, and radiant colors on the cube, CHARMED or SAVE), Haste (a yellow spark to the friend, HASTE), Flaming Sphere (a fire bead swells into the sphere, which stays: `Shapes.fireBall`, kept by `Fx.keep` until the spell ends, with a wide warm light) and the hidden `sphereBurn` (flames lick from the sphere at someone). Step 10a (level 2) added Action Surge (a red outline, SURGE), Divine Spark (a bead in the picked type's colors, half damage with SAVE) and its heal (a radiant dart, a green number), Hide (the rogue ducks and fades, HIDDEN or SEEN); Turn Undead no longer slides the figures (turned undead flee on their own turns). Step 10b (level 3) added Spiritual Weapon (a floating gold hammer, `Shapes.spectralWeapon`, kept while the spell lasts, slamming down with a gold flash), Preserve Life (a green ring, numbers over the healed), Aid (gold motes, +5 HP), Lesser Restoration (a green glow, FREE), Protection from Evil (a gold ward, WARD), Sacred Weapon (the sword flares, and the paladin carries a gold light while it lasts), Steady Aim (AIM), and POTENT under a cantrip's half damage on a miss. Step 10d (level 5) added Spirit Guardians (gold spirits circling the cleric 15 ft out, `Shapes.guardians`, while the spell lasts; hidden `guardiansBurn` when they strike), Mass Healing Word (green motes on every healed friend), Revivify (a gold column, ALIVE), DODGE over the rogue for Uncanny Dodge, and Sear Undead's numbers over turned undead.

| Effect | Look |
|---|---|
| **Fire Bolt** | `cast` with an orange flare at the hand. A 3 px fire bead flies straight (0.35–0.5 s by distance), leaving an ember trail; a fire light (radius 18) rides with it, so walls light up as it passes. Impact: hit-stop, a burst of 15–25 embers, a 1-frame white-orange flash on the target, a scorch mark under them (fades over 8 s). Miss: the bead flies past the target and bursts on the floor or wall behind. |
| **Magic Missile** | Three violet darts leave the hand one after another (80 ms apart), each on a curved path (homing curve, different bend), with short spark trails. They hit at slightly different moments: three small bursts, three numbers. Never misses. |
| **Burning Hands** | A fan of fire from the hands filling a 15 ft cone (3 squares), flickering for 0.5 s, strong fire light, scorch marks across the cone. |
| **Fireball** | A small bright bead arcs to the point (0.6 s). Then: a 1-frame flash, a filled ring of fire grows to 20 ft radius (4 squares) in 0.2 s, an outer shockwave ring, dust and embers thrown out, a big orange light (radius 60) that fades over 0.8 s, embers drifting down, a large scorch circle that stays 20 s. Shake 3 px. |
| **Lightning Bolt** | A jagged white-blue line from the caster, 100 ft (20 squares) or to a wall, redrawn with new jags each frame for 0.25 s. A 1-frame blue-white screen flash. Sparks along the line. Everyone in it flashes. |
| **Ray of Frost** | A pale blue beam with ice-shard particles; the target gets a frost mark at their feet and a blue tint for a few seconds (slowed). |
| **Shield** | A hexagon bubble snaps around the wizard just before the attack lands (reaction); the incoming weapon or bolt bounces off with sparks. Fades over 0.4 s. |
| **Sleep** | Pale pink motes drift down over the area; affected creatures slump; small "z" popups. |

### Cleric

| Effect | Look |
|---|---|
| **Cure Wounds** | Cleric touches the target (step up if needed). Gold motes rise from the ground around the target for 0.8 s, a soft warm light (radius 20), a gold outline on the target for 2 frames, green number. |
| **Healing Word** | Cleric raises a hand; a sparkle flies to a friend up to 60 ft away along a gentle arc; on arrival, a small mote burst and green number. |
| **Sacred Flame** | No projectile: a column of white-gold light drops onto the target from above (0.3 s), with a radiant light and sparks at the feet. Save succeeded: the column hits the ground beside them. |
| **Guiding Bolt** | A bright gold bolt with a long trail; on hit the target keeps a faint glow (next attack has advantage). |
| **Bless** | Three small gold rings float down onto three allies; a faint halo stays over each while it lasts. |
| **Spiritual Weapon** | A translucent glowing hammer appears beside the target and swings on its own (strike, flash, number), then hovers until the next turn. |
| **Turn Undead** | The cleric raises the holy symbol; a gold wave ring spreads out 30 ft; undead caught in it shake, flash, and turn to flee. |

### Fighter

| Effect | Look |
|---|---|
| **Sword swing** | `windup` (blade back, 150 ms), `strike` with a **smear arc**: a crescent of 2–3 bands of light pixels along the blade's path, drawn for 2 frames. Hit: hit-stop, target white flash, knockback 2 px, shake 1 px, 4–6 sparks. Miss: target sidesteps 1 px, a whoosh popup "MISS". |
| **Critical hit** | As above, but hit-stop 200 ms, a bigger smear, knockback 3 px, shake 3 px, a gold "CRIT" popup and a bigger number. |
| **Action Surge** | A red outline flare on the fighter, then two attacks back to back at 1.3× speed. |
| **Second Wind** | The fighter breathes in (1 px rise), a short green-white aura, green number. |
| **Shield bash** | Short lunge, a dust puff, the target staggers back half a square. |
| **Bow / crossbow shot** | Draw pose, an arrow sprite flies straight and fast, sticks in the target briefly or skids on the floor on a miss. |

### Rogue

| Effect | Look |
|---|---|
| **Sneak Attack** | The rogue blurs (afterimages), reappears beside the target, red double slash, extra shake. |
| **Dash / Disengage** | 2–3 fading afterimages along the path. |
| **Thrown dagger** | A spinning dagger sprite (4 rotation frames) flies to the target. |
| **Hide** | The rogue fades to 40% and a little dust settles. |

### Paladin and Dragonborn

| Effect | Look |
|---|---|
| **Divine Smite** | The blade lights up gold during the swing (smear in gold), then a radiant burst on impact: rays out from the target, gold light, extra number in a radiant color. More dice, bigger burst. |
| **Lay on Hands** | Glowing hands on the target, a soft gold light spreading from them, green number. |
| **Dragonborn fire breath** | A short inhale (body rises, embers at the mouth), then a cone of fire 15 ft (3 squares) for 0.6 s: dense ember particles, flickering front edge, strong fire light, scorch marks across the cone. Note: in 5e the breath comes from being Dragonborn, not from the Paladin class; a Dragonborn Paladin has both. |

### Monsters

| Effect | Look |
|---|---|
| **Goblin sling** | Whirl pose, a stone in a shallow arc, a dust puff on hit or miss. |
| **Goblin spear / scimitar** | Short jab or slash, small smear. |
| **Goblin thrown torch** | The torch spins in an arc with its flame and light, bursts into embers, leaves a small burning patch for 2 s. |
| **Skeleton sword / arrow** | Stiff, jerky swing (fewer frames); arrows like the fighter's. Bones rattle (1 px jitter) on hit. |
| **Slime acid** | The slime squashes and spits a green blob in an arc; splash of drops; a sizzling acid mark with small rising bubbles. **Split:** when cut, it pinches in two and the halves hop apart. |
| **Cultist dark bolt** | Purple-black bolt with a dark trail; on hit, a violet flash. |
| **Cultist Darkness** | A black sphere spreads; lights inside it go out (negative light: skip lights in that area), torches and the orb show nothing there. |

## 6. Feel and text

| Moment | What plays |
|---|---|
| Hit | Hit-stop, target white flash (1–2 frames), knockback, small shake, red number rising 10 px over 0.8 s |
| Miss | Target sidesteps 1 px, grey "MISS" popup, no shake |
| Crit | Longer hit-stop, bigger shake, gold "CRIT" above the number |
| Resisted / saved | Number halved, grey "SAVE" popup |
| Heal | Green number with a "+" |
| Down to 0 HP | Death pose; heroes go down (unconscious) with a soft grey flash |
| Condition | Small icon popup: z (asleep), snowflake (slowed), eye (blinded) |

Numbers are in screen space (crisp at any zoom), in a small pixel font, with a 1 px dark outline.

## 7. Dice tray

- A d20 drawn in pixel art in a corner tray. Before an attack or check, it tumbles (6–8 frames of spinning faces, 0.5 s), lands on the rolled number, then shows `+ bonus = total` and "vs AC 15" or "vs DC 12".
- Advantage / disadvantage: two dice roll; the kept one stays bright, the other greys out.
- **Natural 20:** gold burst around the die, the number pulses. **Natural 1:** the die cracks and shakes.
- Damage dice roll after a hit, smaller, then add up into the damage number.
- A toggle to skip the tray animation (fast mode).

## 8. Code shape

Modules in `js/fx/`, each one top-level `const` (tech rules in [overview.md](overview.md) section 4). Built in Step 1:

| Module | File | Job |
|---|---|---|
| `Fx` | fx.js | The player: runs an effect's steps on its own clock (`setTimeScale`, hit-stop), resolves a Promise when done. Holds the step handlers, the fake poses (`POSES`: lean and lift), and the feel (flash, outline, fade, knockback, shake, screen flash) |
| `Spells` | spells.js | The catalog: `add(name, info, steps)`; `restyle(name, steps)` swaps an effect's steps and keeps its label, area and roll. Shared step groups: `struck()` (one target taking a blow) and `caught()` (everyone in an area); both are exported for the looks files |
| `Glow` | glow.js | Banded halo sprites drawn additively: `draw(c2d, x, y, radius, type, k, squash)` and `flash()` (a halo that swells and fades) |
| `Volumes` | volumes.js | Areas at true scale (5 ft = 10 map px): `sphere` (a swelling blast with a shock rim and rising tongues of flame, or a calm dome with `soft`), `cone`, `cube`, `line` (a 5 ft wide beam) |
| `Ropes` | ropes.js | `wrap()`: three glowing rope coils conjured round a figure, winding up legs, body and shoulders, pulling tight and holding (or snapping apart) |
| `Arcs` | arcs.js | Branching lightning: `strike()` (a crooked main stroke and forks, re-rolled every few frames, additive) and `reach()` (how far a line goes before a wall) |
| looks | looks/*.js | The spells' looks after their 2024 text, one file per group (`signature` = Fireball, Lightning Bolt, Magic Missile; `wizardBlast`, `wizardMagic`, `cleric`, `martial`). Each calls `Spells.restyle(name, steps)` and is loaded after spells.js; `spells.js` stays the baseline (the rules, the labels, the first look) |
| `Projectiles` | projectiles.js | `fly()`: sprites `bead`, `dart`, `stone`, `arrow`, `dagger`, `blob`; arcs, sideways curves, trails, a carried light |
| `Blades` | blades.js | `swing()` (blades `sword`, `dagger`, `rusty`; `steps` makes it jerky) with the crescent smear; `thrust()` (spear jab with speed lines) |
| `Shapes` | shapes.js | Things that stay put: `pop` (impact burst), `ring`, `bolt` (lightning to the first wall), `column` (light from above), `bubble` (the shield hexagon), `flare` (a fading light), `emitter` (rising motes, or a cone), `fireBall` (Flaming Sphere, kept on screen by `Fx.keep` until the spell ends); `px`, `line`, `lightAt` helpers |
| `Particles` | particles.js | Particle pool: `ember`, `spark`, `mote`, `heal`, `dust`, `glow` (any type's colors), `drop`, `smoke`, `shard` |
| `Marks` | marks.js | Floor decals that fade: `scorch`, `blast`, `acid`, with glowing embers at first |
| `Deaths` | deaths.js | Death styles from the creature's own sprite: `topple` (goblin), `collapse` (skeleton bones stack into a heap), `melt` (slime), `sink` (cultist, with smoke), `down` (a hero; healing revives) |
| `Popups` | popups.js | Floating numbers and words in a 3 × 5 pixel font (A–Z, 0–9, + - = / !); `text()` draws any string |
| `Palette` | palette.js | Color ramps and light colors per damage type (section 9), plus `steel`, `blood`, `stone`, `bone`, `smoke` |
| `DiceTray` | ../ui/diceTray.js | The d20 in the corner: tumbles, lands, shows `roll + bonus = total`, `VS AC / DC`, the result; gold on a natural 20, cracked on a natural 1 |

Outside `js/fx/`: `Stage` (js/stage.js), the frame loop over the editor's modules; `Figures` (js/figures.js), the characters: flash, outline, fading, afterimages, health bars, lit by the floor under them; `Heroes` and `Poses` (js/art/), the hero art and which pixels a figure shows in its pose (section 3).

**An effect is data: a list of steps.** A step starts at a time in seconds or at an event, and steps run in parallel. Fire Bolt, shortened from `spells.js`:

```js
add('fireBolt', { label: 'Fire Bolt', by: 'Wizard', on: 'enemy' }, [
  { at: 0, do: 'face' },
  { at: 0, do: 'pose', who: 'caster', pose: 'cast', time: 0.5 },
  { at: 0.18, do: 'projectile', from: 'casterHand', type: 'fire', speed: 190, trail: 'ember', lightRadius: 18 },
  { at: 0.3, do: 'pose', who: 'target', pose: 'dodge', time: 0.35, if: 'miss' },
  { at: 'hit', do: 'hitstop', time: 0.08, if: 'hit' },
  { at: 'hit', do: 'pop', type: 'fire', radius: 4, time: 0.22 },
  { at: 'hit', do: 'light', type: 'fire', radius: 28, time: 0.6, power: 1.6 },
  { at: 'hit', do: 'flash', who: 'target', color: FIRE_FLASH, time: 0.08, if: ['hit', 'crit'] },
  { at: 'hit', do: 'mark', kind: 'scorch', where: 'targetFeet', fade: 8, if: ['hit', 'crit'] },
  { at: 'hit', do: 'popup', text: 'amount', color: 'damage', if: 'hit' },
]);
```

- **Steps:** `face`, `pose`, `projectile`, `swing`, `thrust`, `bolt`, `cone`, `hitstop`, `burst`, `pop`, `ring`, `column`, `bubble`, `light`, `emit`, `flash`, `outline`, `fade`, `knock`, `dash`, `flee`, `shake`, `screenflash`, `mark`, `apply`, `popup`, and the 2024-look steps `glow` (a halo: `where` or `who`, `radius`, `time`, `power`), `volume` (`shape` sphere / cone / cube / line, `feet` at true size, `wide` for a line, `type`, `time`) `arc` (branching lightning to the target, or `feet` along a line to the first wall) `rope` (Hold Person: three glowing rope coils wind up a figure and hold, or `snap: true` to burst apart; see `Ropes`) and `images` (Mirror Image's duplicates: `count`, or `extra` on top of the ones the figure has; they split off the figure and hold for `time`). A sphere `volume` takes `soft` (0–1) for a calm dome of light with no flames (Turn Undead, Preserve Life). The place `image` is where the next duplicate stands. `projectile` also takes `glow` (a halo radius) and `streak` (how many past positions its fading tail keeps); `ring` takes `dy`.
- **Who:** `caster`, `target` (the default), or `hits` (everyone an area caught; each gets its own number). `hitIf: 'saved' | 'failed'` narrows `hits` to those who made or failed their save.
- **Places** (`where`, `from`): `casterHand`, `caster`, `casterFeet`, `mouth`, `target` (chest), `targetFeet`, `point` (the aimed spot), `impact` (where the projectile landed); with `who`, `chest` or `feet` of each figure.
- **Events:** `'hit'` by default; a step can name its own (`event: 'd1'` for the second Magic Missile dart, `'cut1'` for Sneak Attack's first slash).
- **`apply`** is the moment damage or healing lands: Fx calls `ctx.onHit(hit, part)`, and the caller (the lab now, combat later) changes HP and starts deaths.
- `at: 'hit'` means "when the projectile lands or the blade connects". A missed bolt still lands (past the target), so `'hit'` fires on a miss too; `if: 'hit' | 'miss' | 'crit'` (or a list) picks the steps by outcome.
- `Fx.play(name, { caster, target, point, result, hits, onHit })` returns a Promise that resolves when nothing is left playing; combat will wait for it ([combat.md](combat.md)).
- `result` comes from the rules: `{ outcome: 'hit' | 'miss' | 'crit', amount, parts }`; `hits`: `[{ fig, amount, parts, saved, heal }]` for areas (defaults to the target). Effects read them; they never roll. Since Step 3 they come from `Rules.resolve` ([rules.md](rules.md)).
- Room for sound later: a step `{ do: 'sound', name: 'whoosh' }` that does nothing yet.

**Where it draws** (`Stage` hooks, see [map-editor-reuse.md](map-editor-reuse.md) section 4):
**Additive drawing:** glows, particles and volumes set `globalCompositeOperation = 'lighter'`; both Canvas 2D and `GlScreen` (blend ONE, ONE) support it. Effects only use that subset of the Canvas API (rects, images, alpha, transforms, axis-aligned clips).

1. `floor`: ground marks, into the map frame before the tint, so lights fall on them and objects cover them.
2. `lights`: each active light (projectile, flare) and each figure's orb or lantern calls `Fire.addLight` with a fresh `Fire.visibility` mask, before `Fire.applyLights`.
3. `screen`, after the map is drawn: mark embers, then figures, then effects (shapes, particles), then popups. Everything here is in screen space at map-pixel or half-pixel size (half-pixels match the characters' detail), so effects draw over the characters. Glowing things use their own colors; dust is multiplied by the darkness tint.
4. Camera shake offsets the whole draw (`Stage.cam.shakeX/Y`).

## 9. Colors

Each damage type has a 3–4 color ramp (bright core → edge) and a light color (multipliers, like the orb's `[0.9, 1.15, 1.5]`).

| Type | Ramp (core → edge) | Light |
|---|---|---|
| Fire | `#fff6c2` `#ffc23d` `#f06b1f` `#9c2a14` | warm `[1.5, 1.05, 0.6]` |
| Cold | `#ffffff` `#c9f1ff` `#6cc6ee` `#2f6fa8` | `[0.8, 1.1, 1.5]` |
| Lightning | `#ffffff` `#e3f4ff` `#8fc8ff` `#4a6dff` | `[1.1, 1.2, 1.6]` |
| Force (Magic Missile) | `#ffffff` `#e1c6ff` `#a86bff` `#5a2fb0` | `[1.2, 0.9, 1.6]` |
| Radiant / holy | `#ffffff` `#fff3b0` `#ffd34d` `#c98a1c` | `[1.5, 1.35, 0.9]` |
| Healing | `#ffffff` `#e8ffd0` `#9be36b` `#3f9a3a` | `[1.1, 1.4, 0.9]` |
| Acid | `#f4ffd6` `#b8f04a` `#5fae2a` `#2c5e1c` | `[1.0, 1.4, 0.7]` |
| Necrotic / dark | `#e6d0ff` `#8a4fd1` `#4a1f7a` `#1a0b2e` | dim violet, low power |
| Physical | sparks `#ffffff` `#ffe9a8`; dust `#a8937a` `#6e5d4b` | none |

Tune these in the lab against the dungeon's dark tint; final values go back into this table.

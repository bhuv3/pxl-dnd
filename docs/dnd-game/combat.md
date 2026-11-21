# Combat in the game

Back to [overview.md](overview.md). The dice rules are in [rules.md](rules.md); this doc is how a fight runs on screen. Built in [roadmap.md](roadmap.md) Step 4 (`fight.html`).

**As built (Step 4):** one room, no exploration: the fight starts at once (section 1 is for Step 5). Turn order bar, action bar, monster turns, reactions, and the end of a fight work as below, with these differences (Step 5a added healing and Sacred Flame for the cleric, aimed at allies or enemies, and Multiattack): Shield is cast automatically when it would turn a hit (no prompt); monster HP shows as words; no morale or fleeing yet; goblins share one initiative roll.

---

## 1. Starting a fight

- **Spotted:** in exploration, each monster checks every half second whether it can see a hero: within its sight range and a line of sight not blocked by walls (the editor's `Fire.visibility` rays), and the hero is in light it can see in (bright or dim, or darkness if it has darkvision). Hidden heroes (Stealth) are seen only if the monster's passive Perception beats their Stealth roll.
- **Ambush:** the party attacks first, or walks into an encounter zone marked as an ambush ([adventures.md](adventures.md)).
- **Who joins:** every monster that can see the fight or is within 6 squares of a monster that joins, plus everyone in the same encounter zone.
- **Snap to the grid:** everyone slides to the nearest free square (0.3 s). The grid fades in. Exploration time stops (the map keeps animating).
- **Surprise:** whoever didn't notice the other side skips their first turn ([rules.md](rules.md) section 6).
- **Initiative:** roll for everyone, in the dice tray, then show the turn order bar.

## 2. Turn order bar

A row of portraits along the top, in initiative order, the current one raised and outlined. HP shown under each (monster HP as a bar only, no numbers: Healthy / Hurt / Bloodied / Near death). Hovering a portrait highlights that creature on the map.

## 3. A hero's turn

1. The camera pans to the hero. Reachable squares glow faintly (flood fill over the grid, costs from [rules.md](rules.md) section 6: walls and enemies block, difficult terrain doubles, a diagonal step about 7 ft by Pythagoras).
2. **Action bar** at the bottom: Attack, spells (by level, with slots left), class features (Second Wind, Action Surge, Cunning Action…), Dash, Disengage, Dodge, Help, Hide, Item, End turn. Each shows what it uses: action, bonus action, movement, reaction.
3. **Move:** click a square; the path is drawn; the hero walks it (walk animation, square by square). Leaving an enemy's reach shows a warning icon (opportunity attack) on the path first.
4. **Target:** choosing an attack or spell shows valid targets (in range, in sight) with the hit chance in percent, worked out from the rules (`(21 − (AC − bonus)) / 20`, with advantage or disadvantage applied). Area spells show the area on the grid under the mouse (cone, sphere, line), with everyone inside outlined.
5. **Resolve:** `Rules.resolve(action, actor, targets, { rng, mode })` rolls and returns `{ outcome, rolls, hits, log }` without changing anything ([rules.md](rules.md)); the tray shows `rolls[0]`, the log gets `log`; then `Fx.play` runs the effect with `hits`, and its `apply` step calls back to take off `hits[i].amount` (already after resistances); combat waits for the Promise; then conditions and deaths update. The lab does exactly this today (`Lab.cast`).
6. Movement can be split around the action. **End turn** when done (or automatically when nothing is left to do).

Keyboard: 1–9 pick actions, Tab cycles targets, Space ends the turn, Esc cancels.

## 4. A monster's turn

Simple, readable AI, per monster kind ([monsters.md](monsters.md) "Tactics"):

1. Pick a target: the nearest hero it can reach, but goblins prefer the lowest AC or lowest HP, archers prefer heroes not next to them.
2. Choose a spot: melee monsters walk to a free square next to the target (shortest path); ranged ones to a square in range and in sight, at least 2 squares from heroes if possible.
3. Act: attack, or cast their best spell; goblins use Nimble Escape to hide or back off.
4. Morale: some flee below half the group (goblins), some never (skeletons, slimes).

Monster turns play at a steady pace (about 0.3 s pause before acting) so the player can follow. A fast-forward button doubles speed.

## 5. Reactions

- **Opportunity attacks** happen automatically for monsters; for heroes, they happen automatically too (an option can ask instead).
- **Shield** (Wizard): when an attack would hit the wizard and Shield would make it miss, the game pauses and asks "Cast Shield?" (Yes / No / Always / Never).
- **Uncanny Dodge** (Rogue): same kind of prompt.

## 6. Ending a fight

- All monsters dead or fled → victory: XP and loot popups, grid fades out, back to exploration.
- All heroes down → defeat (unless someone stabilises): a "The party has fallen" screen with Retry from before the fight.
- Fleeing: if every hero leaves the monsters' sight and the encounter zone, the fight ends; monsters search for a few turns.

## 7. Code shape (planned)

| Module | Job |
|---|---|
| `Combat` | The state machine: `exploring → starting → turn(creature) → resolving → … → ended` |
| `Initiative` | Rolling and order, adding and removing creatures |
| `GridMove` | Squares, costs, reachable flood fill, paths, opportunity-attack checks |
| `Targeting` | Range, line of sight per square, areas (cone, sphere, line, cube) |
| `MonsterAI` | Picks the target, the spot, and the action |
| `ActionBar`, `TurnBar`, `CombatLog` | UI |

Rules modules return results; `Combat` passes them to `Fx.play` and waits. The log writes each roll in plain words: "Goblin attacks Fighter: 14 + 4 = 18 vs AC 18. Hit. 6 slashing damage."

Creatures in a fight keep their editor actor for drawing (position, facing, pose) but are moved by `GridMove`, not by `Actors.update`.

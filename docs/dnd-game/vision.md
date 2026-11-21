# Vision

Back to [overview.md](overview.md).

What the game is and how it should feel. Rules and numbers are in [rules.md](rules.md); fight visuals in [effects.md](effects.md).

---

## 1. One line

A small party of heroes explores hand-made and generated pixel-art maps, talks to villagers, picks locks, springs traps, and fights monsters in turn-based battles on the grid, with every roll of the d20 shown on screen.

## 2. Feel

- **A tabletop session on a screen.** It should feel like a DM is running it: rooms are described when you enter, dice are rolled in the open, and every choice can go well or badly.
- **Every action is animated.** A sword swing, a fireball, a heal: each has a short, punchy pixel-art animation that lights the room. See [effects.md](effects.md).
- **Light matters.** Dungeons are dark. Torches, the wizard's orb, and spells are what let you see. The editor's light engine (light stops at walls) does this already.
- **Small and finished beats big and broken.** A short adventure that plays well is the goal before anything larger.

Inspirations: tabletop D&D 5e, Baldur's Gate 3 (explore freely, fight in turns), Divinity: Original Sin (environment and light in fights), old pixel CRPGs.

## 3. Core loop

1. **Hub:** the village tavern. Get a quest, buy supplies, rest.
2. **Travel** to the place: a cave, dungeon, crypt, swamp, castle (all biomes the editor already generates).
3. **Explore** in real time: walk, open doors, search, talk, make skill checks.
4. **Fight** when monsters see you: the game switches to turn-based combat on the grid.
5. **Loot and rest:** chests, gold, items; short or long rest at a campfire.
6. **Finish** the quest, return, level up. Next quest.

## 4. Two modes

| | Exploration | Combat |
|---|---|---|
| Time | Real time | Turns, in initiative order |
| Movement | Free walking (WASD or click to move) | Square by square, up to your speed |
| What you do | Talk, search, open, pick locks, skill checks | Attack, cast, dash, hide, help, use items |
| Grid | Hidden or faint | Shown; reachable squares highlighted |
| Starts / ends | Ends when a monster spots you, or you attack | Ends when one side is down or flees |

Details of the switch and the turn flow: [combat.md](combat.md).

## 5. The party

- 1–4 heroes. The first playable version has two: a Fighter and a Wizard.
- Classes planned: Fighter, Wizard, Cleric, Rogue, Paladin. One race with a visible power: Dragonborn (fire breath). See [classes.md](classes.md).
- Levels 1–5 only. That's where 5e is simplest and most fun.
- The existing elf wizard sprite is the first hero. The other heroes are drawn in code, like the editor's villagers and monsters, so they can have attack and cast poses.

## 6. Who is the DM (open)

1. **The game.** Adventures are made in the editor with encounters, triggers, and dialogue placed on the map ([adventures.md](adventures.md)). Works offline. *Recommended first.*
2. **Claude as an AI DM.** Describes rooms, plays the people you meet, reacts to typed actions. Needs an API key and a small server, which breaks the "double-click to open" rule, so it would be an optional add-on.
3. **Human DM with friends.** A DM screen sees everything; players see a fogged view (the editor's parked fog of war plan, `../map-editor/fog-of-war.md`). Online play needs a server.

## 7. Out of scope for now

- Multiplayer and online play.
- Levels above 5, multiclassing, feats.
- Character creation screens (heroes are pre-made at first).
- Saving a campaign across sessions (proposed for Step 6 in the [roadmap](roadmap.md)).
- Sound (keep a place for it in the effects data, but no audio yet).

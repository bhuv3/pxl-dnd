# Roadmap

Back to [overview.md](overview.md).

Baby steps, in order. Finish and check every item in a step before starting the next. Each step should end with something the user can open and try.

**Status:** Steps 1–5 and 6a done: "The Cellar Key" plays from the tavern to the end, and `adventure-editor.html` makes new adventures. Step 7 (more spells), 7b (the practice room, Pythagoras, Thunderwave all round), 7c (ten more spells), 7d (the switch to the 2024 rules, SRD 5.2), and 7e (six more spells: Mage Armor, Hold Person, Mirror Image, Flaming Sphere, Hypnotic Pattern, Haste) are done too. Steps 10a–10d (levels 2 to 5, the user's call; Step 6b dropped) are done. Next: Steps 8, 9, and 11.

---

## Step 1: Effects lab

**Goal:** see the fight animations before any rules exist. A page, `fx-lab.html`, shows a small lit dungeon room with heroes and goblins, and buttons that play each attack and spell.

**Spec:** [effects.md](effects.md) (system, timing, data format, per-effect looks).

- **Page:** `dev/dnd-game/fx-lab.html`, plain script tags, opens by double-click.
- **Scene:** one small dungeon room (about 12 × 9 squares) built in JS with `MapModel.create`, stone walls, cave floor, a wall torch or two, `underground` on, so lights show. Built through the editor's render modules (see [map-editor-reuse.md](map-editor-reuse.md)).
- **Cast:** the elf wizard, a fighter, a cleric (both drawn in code), and 2–3 goblins on the other side of the room.
- **Controls:** a side panel with one button per effect; a "who casts" and "who is the target" pick; Hit / Miss / Crit switch; a slow-motion toggle (0.25×) for checking frames.
- **First three effects:**
  1. **Fire Bolt** (Wizard): cast pose, projectile with ember trail and moving light, impact burst, scorch mark that fades.
  2. **Sword swing** (Fighter): wind-up, swing with smear arc, hit flash and knockback on the target, damage number.
  3. **Cure Wounds** (Cleric): cast pose, gold motes rising round the target, soft light, green number.
- **Shared feel:** hit flash, knockback, screen shake, floating numbers, MISS.
- **Code:** `js/fx/` modules (names in [effects.md](effects.md) section 8). Effects are data; the player plays the data.

- [x] Room renders with lights through the editor's modules.
- [x] Heroes and goblins stand in the room.
- [x] Effect player runs steps from data, with slow motion.
- [x] Fire Bolt, sword swing, Cure Wounds.
- [x] Hit, miss, crit feel; floating numbers.

**As built:**
- Room: 13 × 8 squares of flagstone in stone walls, two wall torches, a brazier, a barrel and a crate; `underground`, ambient 0.3 (0.15 hid the characters).
- Our own frame loop, `js/stage.js` ([map-editor-reuse.md](map-editor-reuse.md) section 2, option B). The editor is unchanged.
- Characters are lit by the light on the floor under them (`Stage.lightAt`), not only by the darkness tint, so a fire bolt's flash or a torch lights them up. The editor's characters don't do this.
- Stand-ins until Step 2's hero art: the fighter is a villager guard without a spear, with a sword drawn on by `Figures`; the cleric is a villager monk with a lantern light added by the lab (villagers carry no light in the editor). Poses are faked by leaning and lifting the sprite.
- Fire Bolt has an impact "pop" (a swelling fire disc) and the scorch keeps glowing embers for 2 s, so it reads even in the dark.
- The swing blade is drawn longer than the held sword (14 vs 8 character pixels), and the smear is a steel-colored crescent (gold on a crit).
- Click a figure on the map to make it the target. A melee attack picks the nearest enemy when the target isn't next to the fighter.

**Done when:** pressing Fire Bolt sends a glowing bolt across the dark room that lights the walls as it flies and leaves a scorch on the floor; the sword swing knocks a goblin back with a white flash; Cure Wounds lifts gold motes and a green number over the cleric.

## Step 2a: All the effects, deaths, and the dice

**Goal:** every effect for the first adventure plays in the lab, monsters fight back, creatures die in their own way, and a d20 tumbles before each roll.

- **Spells and attacks** ([effects.md](effects.md) section 5): Magic Missile, Fireball, Lightning Bolt, Shield (Wizard); Healing Word, Sacred Flame, Turn Undead (Cleric); Sneak Attack, thrown dagger (Rogue); Divine Smite, Dragonborn fire breath (Paladin).
- **Monster attacks:** goblin sling and spear, skeleton sword and arrow, slime acid, cultist dark bolt.
- **Areas:** Fireball (20 ft radius), Lightning Bolt (100 ft line), breath (15 ft cone), Turn Undead (undead within 30 ft) hit everyone inside, each with their own number.
- **HP and deaths:** the lab keeps HP (stat blocks from [monsters.md](monsters.md), heroes from [classes.md](classes.md)), shows a small bar when hurt, and plays a death when HP reaches 0: skeleton collapses into a bone pile, slime melts into a puddle, cultist sinks leaving a wisp of smoke, goblin topples, a hero drops (healing brings them back). "Reset" revives everyone.
- **Dice tray:** a pixel d20 in the corner tumbles and lands before attack rolls and saves, shows `+ bonus = total vs AC / DC`, with a gold burst on a natural 20 and a crack on a natural 1. Can be turned off.
- **Cast:** add a rogue and a paladin (stand-ins, like the fighter), a skeleton, a slime, and a cultist.
- Poses are still faked (lean, lift, dash, fade); real ones are Step 2b.

**Done when:** every button in the lab plays, area spells hit everyone inside, a goblin killed by a Fireball topples, a skeleton hit by Divine Smite falls into bones, and a natural 20 makes the die burst gold.

- [x] Wizard, Cleric, Rogue, Paladin effects (11 new) and 6 monster attacks: 20 effects in all.
- [x] Areas: Fireball, Lightning Bolt, fire breath, Turn Undead, each catching everyone inside.
- [x] HP, health bars, five death styles, healing a downed hero, Reset.
- [x] Dice tray with natural 20 and natural 1.
- [x] Checked: every effect × hit / miss / crit, with the tray on and off (120 runs), no errors; the main ones checked frame by frame.

**As built:**
- New modules: `Projectiles` (bead, dart, stone, arrow, spinning dagger, acid blob), `Blades` (swing with sword / dagger / rusty blade and stiff steps; spear thrust), `Deaths`, `DiceTray` (js/ui/diceTray.js). `Shapes` gained `ring`, `bolt`, `column`, `bubble`, and cone emitters. See [effects.md](effects.md) section 8.
- Area effects hit enemies only (the wizard's Sculpt Spells; the breath and Lightning Bolt would hit friends too in 5e). On "Miss" everyone in an area saves for half; save spells treat "Crit" as a failed save.
- Shield is played as a reaction: the nearest enemy that isn't in melee (the skeleton, as placed) shoots the wizard and the arrow glances off.
- The tray's number is chosen to match the outcome you pick (a hit rolls high enough to beat the AC); the lab still decides outcomes until Step 3.
- Stand-ins: the paladin is a second villager guard with a sword, the rogue a villager with a dagger; neither looks like its class yet (Step 2b). The fire breath comes from the paladin as a Dragonborn, without dragonborn art.
- Not done: the slime splitting when cut ([monsters.md](monsters.md)), Darkness, Sleep, Burning Hands, Ray of Frost, Bless, Spiritual Weapon, Guiding Bolt, Action Surge, Second Wind, shield bash, Hide, Lay on Hands, goblin thrown torch. Add them when a step needs them.

## Step 2b: Hero art and real poses

**Goal:** the five heroes drawn in code (Fighter, Wizard, Cleric, Rogue, Dragonborn Paladin) like the editor's villagers, each with stand, walk, wind-up, strike, cast, hit, and down poses; monsters get wind-up and strike poses too. Replaces the stand-ins and the faked poses.

**Done when:** each hero is recognizable at a glance, and a sword swing shows the arm and blade moving, not just a lean.

- [x] Fighter (human, helmet, chain mail, red tabard, sword, red shield), Wizard (high elf, pointed hat, blue robe, staff with a glowing orb that lights the floor), Cleric (dwarf, steel cap, big beard, chain and white tabard with a gold sun, mace, shield), Rogue (halfling, green hood, leather, dagger, bare feet), Paladin (red dragonborn: snout, horns, glowing eyes; plate with gold trim, blue cape, sword).
- [x] Side view: stand, 4 walk frames, windup, strike, cast, raise, inhale, hit, dodge, down. Front and back: stand and walk.
- [x] Swings turn the hero's real arm; projectiles start from the real hand.
- [x] Monsters lean into windup, strike, cast, hit, and dodge (sheared sprite).
- [x] Checked: a sheet of every hero in every pose; the swing, a goblin jab, a cast, heroes going down; the 120-run sweep again with no errors and no pose left on.

**As built:** `Heroes` (js/art/heroes.js) registers the five as editor character families (`hero-fighter` … `hero-paladin`) so `CharacterArt` builds their stand and walk; action poses come from `Heroes.posed` (side views, cached). `Poses` (js/art/poses.js) picks a figure's pixels. The lab no longer loads the packed elf wizard. Monsters' poses are a shear, not new art, because their drawing lives in the editor's `monsters.js`; real monster poses would mean changing the editor.

## Step 3: Dice and rules core

**Goal:** the numbers. No screen changes beyond a test panel.

- `js/rules/`: dice (`2d6+3`), ability modifiers, checks, attack rolls, damage, advantage and disadvantage, saving throws ([rules.md](rules.md)).
- Pre-made level 1 Fighter and Wizard; goblin stat block ([classes.md](classes.md), [monsters.md](monsters.md)).
- The lab's buttons now roll for real: hits and misses come from the dice.

**Done when:** pressing "Fighter attacks goblin" rolls a d20 in the tray, adds the bonus, compares to AC 15, and plays a hit or a miss to match.

- [x] `js/rules/`: `Dice` (notation, seeded, crits double dice, advantage / disadvantage, Lucky), `Creatures` (sheets, modifiers, proficiency, save bonuses), `Actions` (what each of the 20 actions does), `Rules.resolve` (attack rolls, natural 20 and 1, saves, half damage, resistance / vulnerability / immunity, healing, Turn Undead, Shield).
- [x] All five heroes and the goblin, skeleton, slime, and cultist as data, not just Fighter, Wizard, and goblin.
- [x] The lab rolls for real; Hit / Miss / Crit force an outcome for testing effects; Normal / Advantage / Disadvantage; a roll log in plain words.
- [x] Dice tray shows the second die (advantage, disadvantage, or the 1 a halfling's Lucky rerolled).
- [x] Checked: `node tests/dnd-game/rules-test.js` (29 checks: dice ranges, 55% hits and 5% crits for the fighter against a goblin, advantage averages, Lucky, saves, half damage, resistances, Shield, every action); the lab sweep (20 actions × dice / hit / miss / crit × normal / advantage = 160 runs) with no errors and forced outcomes honored.

**As built:**
- `Rules.resolve(id, actor, targets, { rng, mode, force, with })` returns `{ outcome, rolls, hits, shielded, log }` and changes nothing; the caller applies `hits[i].amount` (already after resistances) when the effect's `apply` step fires. This is the contract Step 4's combat will use.
- Area spells roll damage once; each target saves on its own (the tray shows the first target's save, the log shows all). Effects can now act only on targets that saved or failed (`hitIf`).
- Shield: the monster's own ranged attack is rolled against the wizard; 13–17 is blocked (AC 18 with Shield), 18 or more (or a natural 20) gets through and plays the plain shot.
- The lab still lets level 1 heroes do things they can't yet: Fireball and Lightning Bolt are 3rd-level spells (wizard level 5), Divine Smite starts at paladin level 2. Step 4 should only offer what the sheet allows.
- Not built yet: ability checks and skills, conditions, cover, range, concentration, spell slots, death saves, initiative, rests, levels ([rules.md](rules.md) "Built so far").

## Step 4: One fight

**Goal:** a full turn-based fight in one room ([combat.md](combat.md)).

- Initiative, turn order bar, movement on the grid with reachable squares shown, action menu, targeting, monster turns, HP bars, a combat log, win and lose.

**Done when:** Fighter and Wizard can beat (or lose to) two goblins in a room (a hard fight at level 1, see [monsters.md](monsters.md) "Encounter sizing"), start to finish, with no help from the console.

- [x] `fight.html`: Fighter and Wizard against a spear goblin and a goblin archer in an 11 × 7 room with crates and a pillar.
- [x] Initiative (goblins share a roll), turn order bar with portraits and HP, round banner, combat log.
- [x] Movement on the grid: lit reachable squares, path preview, walk animation; allies passable, enemies block; no squeezing past corners.
- [x] Action bar: the hero's actions with costs, spell slots, Dash, Disengage, Dodge, End turn; keys 1–9, Space, Esc; hit chance on hover.
- [x] Opportunity attacks, Shield as an automatic reaction, Nimble Escape, Second Wind, advantage / disadvantage (Dodge, ranged with an enemy adjacent, long range, unconscious target), melee crits on unconscious heroes.
- [x] Heroes at 0 HP fall unconscious and make death saves; damage while down fails them; victory stabilizes the fallen. Victory and defeat screens with "Fight again".
- [x] Checked: 37 fights played start to finish by the AI on both sides (12 + 25) with no errors and none stuck, 11 of 12 won; an opportunity attack set up on purpose; Fire Bolt picked and aimed with real clicks; 32 rules tests.
- [ ] Not checked: a whole fight played by hand with the mouse (the in-app browser runs animations at about 1.5 frames a second).

**As built:** `Squares` (js/combat/squares.js), `Combat` (js/combat/combat.js), `CombatAI` (js/combat/ai.js), `GridOverlay` (js/combat/gridOverlay.js), `CombatUI` (js/ui/combatUI.js), and the page `Fight` (js/fight.js). Monsters and auto-played heroes use exactly the same moves as the player (`Combat.api`). Each new fight uses the next seed, so a seed replays the same rolls. Not built: cover, difficult terrain, conditions, morale (fleeing goblins), a prompt for Shield (it's automatic), resting.

## Step 5a: Exploring the goblin cave

**Goal:** the cave part of the first adventure, playable start to finish: walk in, get spotted, fight, explore, find the key.

- `adventure.html`: Fighter, Wizard, and Cleric explore a goblin cave (tunnel, guard room, locked storeroom, passage, boss room) built in code from adventure data ([adventures.md](adventures.md)).
- **Exploring:** click to walk the party leader (pick the leader from the party panel); the others follow in a line. Room descriptions appear the first time the party enters.
- **Spotted:** a monster that can see a hero within 7 squares (walls and closed doors block sight) starts a fight with its whole group, right where everyone stands (Step 4's combat). Victory returns to exploring; defeat offers a retry from the start of that fight.
- **Doors:** click to open; closed doors block walking and sight. The storeroom door is locked: force it with a Strength check (DC 12, the strongest hero tries; retries allowed).
- **Trap:** a hidden tripwire in the passage (DC 14): the party's best passive Perception spots it from 2 squares away, or Search (an active Perception check) finds it; stepping on it means a Dexterity save or 1d10 piercing.
- **Chest:** in the storeroom: gold and two potions of healing (2d4 + 2), drunk from the party panel outside fights.
- **Short rest:** outside fights: each hero spends their hit die (and a fallen, stable hero gets up), Second Wind comes back.
- **Cleric in combat:** Sacred Flame, Healing Word (bonus action, brings a fallen ally back), Cure Wounds (touch).
- **Goblin boss:** two scimitar attacks a turn (Multiattack), Nimble Escape. Beating him gives the cellar key and ends the quest.

**Done when:** a player can walk in, fight the guards, force the storeroom, avoid or spring the trap, open the chest, beat the boss, and see "Quest complete", with no help from the console.

- [x] `adventure.html` with the cave built from data (`Cave`, js/adventure/cave.js): tunnel, guard room, storeroom, passage, boss camp.
- [x] Exploring (`Explore`): click to walk, the others follow; pick the leader; room descriptions; Search; short rest; potions.
- [x] Spotting (7 squares, walls and closed doors block sight) starts Step 4's combat with the whole group; victory goes back to exploring; defeat offers a retry from the start of that fight.
- [x] Doors (open, block walking and sight while closed), the locked storeroom (Athletics DC 12), the tripwire (DC 14 to find; DEX DC 12 or 1d10), the chest (18 gold, 2 potions).
- [x] Cleric spells in combat, the goblin boss with Multiattack, Nimble Escape for goblins.
- [x] Checked: a scripted playthrough from the tunnel to "Quest complete" (the AI played the heroes' fight turns; everything else was clicked as a player would): guards beaten, door forced, chest opened, search failed, trap sprung, potion drunk, boss beaten. No errors. 35 rules tests; 6 fights on `fight.html` after its controls moved to `CombatInput`.
- [ ] Not checked: the whole cave played by hand with the mouse.

**As built:** `Cave` holds the map and the adventure data (party, monsters with groups, the goal group, doors, locks, chests, traps, areas, the ending): the start of the file format in [adventures.md](adventures.md). `Explore` (js/adventure/explore.js) walks and interacts; `Adventure` (js/adventure/adventure.js) runs the page, the fights, and the retries. The player's fight controls moved from `fight.js` into `CombatInput` (js/combat/combatInput.js) so both pages share them. Fixed on the way: combat stored death saves in `creature.saves`, the same field as the sheet's saving-throw list; it's `creature.deathSaves` now. Not built: stealth and surprise, disarming traps, keys, an inventory beyond potions, saving the game.

## Step 5b: The village and the tavern

**Goal:** the start and end of "The Cellar Key": the tavern in a village, the innkeeper's dialogue, walking to the cave and back, the reward, level 2.

- A village map (made in the editor, or generated) with the tavern; the cave entrance as an exit.
- Dialogue with the innkeeper ([adventures.md](adventures.md) section 3), quest flags, travel between maps, the reward.
- Adventure data loaded from a file instead of code.

**Done when:** a player can play the adventure from the tavern to the end ([adventures.md](adventures.md) section 6).

- [x] Millbrook, made by the map editor's village generator (seed 4, flattened), with the Bent Spoon tavern and Marta the innkeeper beside it.
- [x] Dialogue with choices, a Persuasion check (DC 12, for 80 gold instead of 50), quest flags, and different lines before, during, and after the quest.
- [x] Exits: the east road (refused until you have the quest) to the cave; the tunnel mouth back. Each map remembers its state (doors, traps, the dead, rooms seen); HP, gold, potions, and flags go with the party.
- [x] The reward, a long rest, and level 2 for everyone (more HP, a hit die, slots, a new feature listed); the end screen.
- [x] The adventure is a data file, `adventures/cellar-key.js` (it calls `Adventures.add`, so double-clicking the page still works).
- [x] Checked: a scripted playthrough of the whole adventure: leaving early refused, the innkeeper talk (Persuasion failed), the road to the cave, the guards, the forced door, the chest, the boss (the key flag), out through the tunnel mouth, the key handed in, 68 gold, level 2, the end screen. No errors. 36 rules tests.
- [ ] Not checked: played by hand with the mouse.

**As built:** `Adventures` (registry), `Maps` (build from data, names to squares), `Dialogue` (the talk box), `Explore` (now with townsfolk, exits, the shared bag, and resuming a map), `Adventure` (maps, travel, talks, fights, retries, the end). `Cave` (js/adventure/cave.js) is gone: its data moved into the adventure file. Water now blocks squares. Level 2 features are listed but not usable in fights yet (Action Surge, Channel Divinity).

## Next steps

Steps 8–12 are proposals; the open decisions in [overview.md](overview.md) change some of them. Before long, someone should play "The Cellar Key" once by hand with the mouse: no step so far has been played that way, and fixes from it go in first.

**Why this order:** the user chose the adventure editor first, then more spells. Saving comes next because every later step makes the game longer, and the second adventure carries the party over from the first. Rogue and Paladin are cheap (their art, effects, and sheets exist). Level 2 features are needed before an adventure that starts at level 2. Levels 3–5 come last because they need the most new spells.

## Step 6a: Adventure editor, placing things

**Goal:** make an adventure by clicking instead of writing the data file: on a map from the map editor, place who and what is where, try it, and export the file `adventure.html` plays. (Moved ahead of saving at the user's request.)

- **Page:** `dnd-game/adventure-editor.html`, its own page; the map editor is unchanged. It loads the editor's drawing modules like the game does.
- **Adventures:** start a new one, open one (an adventure `.js` file, or one the game already has, like "The Cellar Key"), and edit its name, party, start, the quest lines shown in the party panel, and the ending.
- **Maps:** add a map from a map editor `.json` file (embedded in the adventure, packed small) or from the generator (biome, size, seed). Maps are flattened like the village (no hills yet). Characters placed in the map editor (goblins, villagers) come in as monsters and townsfolk.
- **Tools:** select, spot, monster, townsperson, door, chest, trap, exit (drag a rectangle), room description (drag a rectangle), delete. Monsters and townsfolk show as they'll look in the game; the rest as marks with labels.
- **Properties:** the selected thing's settings in the side panel: a monster's sheet, name, group, and role; what happens when a group is beaten (a line, a flag); a door's lock (skill, DC, text); a chest's gold and potions; a trap's DCs and damage; an exit's destination, arrival spot, and needed flag; a townsperson's role and line (or a dialogue from the file: editing dialogue is 6b).
- **Problems list:** no start spot, an exit to a spot that doesn't exist, something placed in a wall.
- **Try it:** Play from the start, or play the shown map, in `adventure.html`, without exporting.
- **Export:** downloads the adventure `.js` file. `adventure.html?a=<id>` plays any file in `adventures/`.
- The game changes this needs: maps from packed editor maps, doors and chests on maps that weren't carved, townsfolk with just a line, quest lines and the level-up text from the data instead of written for "The Cellar Key".

**Done when:** "The Cellar Key" opens in the editor with everything where it is; a new adventure made in the editor, on a map saved by the map editor, with goblins, a locked door, a chest, a trap, an exit, and a townsperson, plays in `adventure.html` after export.

- [x] `adventure-editor.html`: New, Open file, open one of the game's adventures, Export, Play from start, Play this map; work kept in `localStorage` (`dnd-game:editor`) between reloads.
- [x] Maps from a map editor `.json` (packed: a 165 KB map file became 7 KB) or the generator (7 biomes, 3 sizes, a seed); the map's goblins, villagers, doors, and chests come in as adventure things.
- [x] Ten tools (keys 1–0): select (and drag to move), spot, monster, townsperson, door, chest, trap, exit and room text (drag a rectangle), delete. Wheel zooms, right-drag pans; daylight while editing, or the game's light.
- [x] Panel forms for the adventure (name, file name, party, start, quest lines, ending), the map, the selected thing, and each monster group's "when beaten" (a line, a flag, gold, the end).
- [x] Problems: no start, an exit to nowhere or to a missing spot, an exit nobody can walk onto, a thing on a blocked square, a missing dialogue.
- [x] The game: `adventure.html?a=<id>` loads `adventures/<id>.js`; `?test` plays what the editor sent; packed editor maps; doors and chests on any map; townsfolk with just a line; quest lines and the level-up text from the data; a beaten group can end the adventure.
- [x] Checked: "The Cellar Key" opened in the editor with all 15 things and no problems; a test adventure made with the editor's own mouse handlers and forms (a map built like a map editor save with 2 goblins, a villager, a door, and a chest; a generated meadow; a spot, a trap, a room, two exits; the door locked, the chest filled, the villager's line, the group's ending) exported, read back identically, and played through in `adventure.html`: the line, out to the meadow and back, the door forced, the trap spotted, the goblins beaten (the AI played the fight), the closing line and the end screen. `?a=` with a file, a missing file, and "Play this map" on the cave. No errors. 36 rules tests.
- [ ] Not checked: used by hand with the mouse; an export through the browser's real download (the file text was checked instead).

**As built:** `AdvFile` (js/editor/advFile.js: new, read, write, adding maps, play), `EditorView` (js/editor/view.js: the map, figures, marks, mouse to square, zoom and pan), `EditorPanel` (js/editor/panel.js: the forms), `Editor` (js/editor/editor.js: tools, mouse, problems, files). The map is drawn by the game's `Stage`, so it looks as it will in the game. Limits: deleting or moving a door or chest that came with the map file leaves the map's own sprite drawn where it was (it just won't open or block); only the shown map is checked for blocked squares; Rogue and Paladin can be picked for the party but aren't finished (Step 8).

## Step 6b: Adventure editor, dialogue and triggers (dropped, the user's call)

**Goal:** edit dialogue in the editor: nodes, choices, checks, actions, flags; and what happens when things are done (a group beaten, a chest opened, an area entered).

**Done when:** Marta's whole dialogue can be rebuilt in the editor and plays the same.

## Step 7: More spells

**Goal:** more choices in a fight for the level 1 heroes: four new wizard spells and four new cleric spells, each with its effect and the rules it needs, usable in real fights, not just the lab. (Added at the user's request, before saving.)

- **Wizard:** Ray of Frost (cantrip: an icy beam, 1d8 cold, the target's speed −10 ft until your next turn); Burning Hands (1st level: a 15 ft cone, DEX save, 3d6 fire, half on a save); Thunderwave (1st level: a 15 ft cube from you, CON save, 2d8 thunder and pushed 10 ft, half and not pushed on a save); Sleep (1st level: 5d8 HP of creatures within 20 ft of a point fall asleep, lowest HP first, no save; a sleeper wakes when hurt; undead are immune).
- **Cleric:** Guiding Bolt (1st level: ranged spell attack, 4d6 radiant, the next attack on the target has advantage); Inflict Wounds (1st level: melee spell attack, 3d10 necrotic); Bless (1st level, concentration: up to 3 allies add 1d4 to attack rolls and saves); Shield of Faith (1st level, bonus action, concentration: +2 AC on one creature).
- **Rules:** conditions with a duration (asleep, slowed, guided, blessed, shielded by faith); concentration (one spell at a time; damage means a CON save, DC 10 or half the damage, or it ends); forced movement (pushed away, stopped by walls and creatures, no opportunity attacks); areas on the grid (cone, cube, circle) from the caster or a chosen square.
- **Aiming:** cone and cube spells pick a direction (the square you point at); circle spells pick a square in range. The squares caught are lit before you click, with who's inside.
- **Spell slots:** the wizard has 2 and the cleric 2 at level 1, so these compete with Magic Missile and Cure Wounds; the action bar shows slots left.
- **Monster AI:** goblins don't cast; the AI-played heroes (tests, auto fights) pick the new spells when they're good: Sleep on a group of hurt goblins, Burning Hands when 2+ are in the cone, Bless before a fight's first attacks.

**Done when:** in `fight.html`, the wizard can put goblins to sleep, burn two in a cone, and push one off with Thunderwave; the cleric can Bless the party, Guiding Bolt a goblin so the fighter gets advantage, and a hit on the cleric can break concentration. Every new spell also plays in the lab.

Maybe split into 7a (the rules, aiming, and the wizard's spells) and 7b (the cleric's). (Built in one go.)

- [x] Wizard: Ray of Frost, Burning Hands, Thunderwave, Sleep. Cleric: Guiding Bolt, Inflict Wounds, Bless, Shield of Faith. Each with rules data, an effect, and a place on the hero's action bar.
- [x] `Conditions` (js/rules/conditions.js): asleep, slowed, guided, blessed, Shield of Faith, with durations ticked at turn starts and ends; concentration with the CON save; labels over the figures (ZZ, SLOW, GUIDED, BLESS, +2 AC).
- [x] Areas on the grid (`Combat.areaOf`): a cone and a cube pointed from the caster, a circle on a square in range and sight; walls and solid props block. Aiming lights the squares in orange and the hint names who's caught (friends marked). Thunderwave's push slides creatures back until a wall or a creature stops them.
- [x] Shake awake: an action to wake a sleeping friend next to you (the button appears when there is one); goblins do it too.
- [x] The AI-played heroes Bless early, aim area spells where they catch 2+ enemies and no friends, and use Guiding Bolt with a slot to spare.
- [x] Fixed on the way: an opportunity attack could have been a free Inflict Wounds; opportunity attacks are weapon attacks only now.
- [x] Checked: 52 rules tests (16 new: Sleep's pool and order and immunities, Bless's hit rate, AC 20, the slow and when it ends, the push, concentration DC and dropping); the lab sweep (29 effects × dice / hit / miss / crit, 116 runs) with no errors; Burning Hands aimed with the mouse and cast with a click; each new spell played in a real fight (Thunderwave, Ray of Frost, Guiding Bolt, Inflict Wounds, Shield of Faith then a hit breaking concentration, Sleep catching friends and the elf immune, Shake awake); 26 AI-played fights (14 on `fight.html`, 12 with fighter, cleric, and wizard against four goblins): 24 won, 2 lost, none stuck, no errors; Bless in all 12 three-hero fights, Sleep in 7, Burning Hands in 5, concentration checks in 3. The AI never chose Guiding Bolt (its slots went to Bless and healing) or Shake awake (no friend asleep beside it); both were checked by hand above.
- [ ] Not checked: played by hand with the mouse beyond the one Burning Hands.

**As built:** spells are rows in `Actions` (new kinds `sleep`, `buff`, `wake`; new fields `area`, `size`, `sculpt`, `adds`, `push`, `concentration`, target `party` and `sleeper`) and effects in `Spells`. `Combat.act` takes a square for area spells and calls `many` (one roll, everyone's saves, then pushes). Fireball and Lightning Bolt still only play in the lab (level 5). Not built: picking Bless's targets, the wizard preparing spells, Mage Armor, Guidance.

## Step 7b: Practice room, Pythagoras, Thunderwave all round (user requests)

- [x] `practice.html` (`Practice`, js/practice.js): a 16 × 11 room, one goblin, pick Fighter, Wizard, Cleric, Rogue, or Paladin. Each has everything they can do, past level 1 too (the wizard's Fireball and Lightning Bolt with 3rd-level slots, the paladin's Divine Smite and fire breath, the rogue's Sneak Attack and thrown dagger). Switches, changeable mid-fight: the goblin can't die (it goes back to full HP), it doesn't fight back, and the hero gets their action, movement, slots, and uses back after everything. Start again; the chosen hero is remembered (`dnd-game:practice-hero`).
- [x] `Combat.start` takes `practice: { unkillable, passive, endless }` for this. Fireball (a 20 ft circle, 150 ft), Lightning Bolt (a 100 ft line, stopped by walls), fire breath (a 15 ft cone) are real areas in fights now.
- [x] Distances by Pythagoras (`Squares.distance`), walking by cheapest path with √2 diagonals (`Squares.reachable`), reach and opportunity attacks by the 8 squares around (`Squares.touching`). An action with no range uses its weapon's ("20/60"), so a skeleton's bow and the rogue's dagger have real ranges.
- [x] Thunderwave covers the 8 squares round the caster (a 15 ft cube centred on them) instead of a cube to one side; no aiming, click anywhere.
- [x] Fixed: starting a new fight while one was mid-turn let the old fight's AI move and act in the new one (Start again could do it); a replaced fight now stops.
- [x] Checked: every action of all 5 heroes in the practice room (21) with the goblin never dying and slots refilling; 30 ft reaching 6 squares straight and 4 diagonally; Thunderwave's 8 squares catching a diagonal goblin; 14 AI fights back to back with one restarted mid-fight, no errors; exploring and a cave fight in the adventure; 52 rules tests.

## Step 7c: Ten more spells (the easy batch)

**Goal:** ten more spells from the user's list, the ones that fit the rules already built: Acid Splash, Poison Spray, Shocking Grasp, Chill Touch, True Strike (cantrips); Chromatic Orb (1st); Scorching Ray, Shatter, Blur, Misty Step (2nd). They go in the practice room's wizard; the adventure's level 1 wizard keeps his spells until levels and spell choice (Step 12).

- Acid Splash: DEX save, 1d6 acid, the target and one more enemy next to it. Poison Spray: CON save, 1d12 poison, 10 ft. Shocking Grasp: melee spell attack, 1d8 lightning, no reactions until its next turn. Chill Touch: ranged spell attack, 1d8 necrotic, no healing until the caster's next turn. True Strike: concentration; advantage on the caster's first attack against the target on their next turn.
- Chromatic Orb: ranged spell attack, 3d8, a damage type the player picks (acid, cold, fire, lightning, poison, thunder); the orb takes its color.
- Scorching Ray: three rays, an attack roll each, 2d6 fire each. Shatter: a 10 ft circle within 60 ft, CON save, 3d8 thunder. Blur: concentration, attacks against the caster have disadvantage. Misty Step: bonus action, teleport to a free square within 30 ft that the caster can see.
- Fixed with it: Guiding Bolt's advantage ended at the end of the cleric's own turn, before anyone else could use it; it lasts to the end of the cleric's next turn now.

**Done when:** every one plays in the practice room with the real rules, and in the lab.

- [x] The ten spells: rules rows in `Actions` (new kinds `rays` and `teleport`; `pair`, `types`, area `spot`), effects in `Spells` (plus a hidden `mistyStepIn`), and all in the practice room's wizard (18 spells now, with 2nd-level slots).
- [x] New conditions: shocked (no reactions until its own next turn), chilled (no healing until the caster's next turn), foreseen (True Strike), blurred (Blur). `Conditions.canReact` gates opportunity attacks and Shield.
- [x] Controls: Chromatic Orb shows a row of damage-type buttons when picked; Misty Step aims at a free square in range and sight; Acid Splash picks the second enemy itself (the nearest one next to the target).
- [x] Fixed: Guiding Bolt's advantage now lasts to the end of the cleric's next turn (conditions can `skip` a turn); an area that catches no one no longer stops the fight; advantage from a mark helps only the first of Scorching Ray's rays.
- [x] Checked: 60 rules tests (8 new: the guided duration, shocked, three rays and their hit rate, the orb's type, poison immunity, two saves for Acid Splash); every wizard spell cast in the practice room next to the goblin and from 4 squares away (33 casts), no errors; Acid Splash on two goblins and Chromatic Orb's type picked with the real controls; the ten effects in the lab under dice / hit / miss / crit (40 runs); 14 AI fights.
- [ ] Not checked: by hand with the mouse.

**As built:** Not built from 5e: Shocking Grasp's advantage against metal armor, Chill Touch's disadvantage for undead attacking the caster, choosing Acid Splash's second target, splitting Scorching Ray's rays between targets. (Several of these spells changed in Step 7d, to the 2024 text.)

## Step 7d: The 2024 rules (SRD 5.2) (user request)

**Goal:** the game follows the 2024 Player's Handbook rules, through their free licensed part, the SRD 5.2 (CC BY 4.0), instead of the 2014 rules (SRD 5.1). Every built spell, feature, species trait, and monster was checked against the SRD 5.2 text (`media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.pdf`); the ones that differ were changed. Done before the medium spell batch, so those are built on the 2024 text.

- Spells changed: Acid Splash (a 5 ft radius sphere within 60 ft, DEX save each), Poison Spray (a 30 ft spell attack, 1d12), Shocking Grasp (no opportunity attacks, other reactions fine), Chill Touch (touch, 1d10, no healing until the end of the caster's next turn), True Strike (an attack with the wizard's quarterstaff using Int, radiant or bludgeoning), Chromatic Orb (two matching damage dice: it leaps to an enemy within 30 ft of the target), Sleep (5 ft radius within 60 ft, a WIS save or drowsy, then a second save or asleep; concentration), Inflict Wounds (CON save, 2d10, half on a save), Cure Wounds 2d8 + Wis, Healing Word 2d4 + Wis, Divine Smite (a paladin spell: the slot and the bonus action go only on a hit; +1d8 against undead or fiends). Sculpt Spells is gone (an Evoker feature at level 6 now): areas hit friends.
- Heroes rebuilt the 2024 way: a background gives the ability score increases and an Origin feat (Soldier: Savage Attacker; Sage and Acolyte: Magic Initiate; Criminal: Alert), species give traits only. Fighter: Defense (AC 19), Second Wind twice, Alert (human Versatile). Wizard: 3 cantrips (Fire Bolt, Ray of Frost, Shocking Grasp), 4 prepared spells (Magic Missile, Burning Hands, Thunderwave, Shield) plus Sleep (Magic Initiate), a quarterstaff and dagger. Cleric: Protector (heavy armor), 4 prepared spells plus Shield of Faith (Magic Initiate), no Disciple of Life before level 3. Rogue: Expertise, Alert. Paladin: spells and Divine Smite at level 1, the breath as 1d10 cone or line, twice a long rest.
- New rules: one spell with a slot a turn; weapon mastery (longsword Sap, shortsword Vex); Savage Attacker (once a turn); Alert (proficiency on initiative); Expertise; incapacitated; Trance (elves can't be put to sleep); goblins' +1d4 with advantage; short rests give back one Second Wind or Channel Divinity.
- Monsters to their 2024 blocks: the goblin is the Goblin Warrior (10 HP, Dex 15, fey), a new Goblin Minion (7 HP, AC 12, daggers), the boss (Dex 15, both attacks +1d4 with advantage), the skeleton (AC 14, +5, 1d6+3), the slime from the 2024 Gray Ooze (AC 9, speed 10, resists acid, cold, fire; 2d8+1 acid), the cultist's ritual sickle.
- Level 2 to the 2024 tables: Wizard Scholar, Cleric two Channel Divinity (Divine Spark, Turn Undead), Paladin Fighting Style and Paladin's Smite.
- The credit line on every page with rules is the SRD 5.2 one.

**Done when:** the rules tests cover each change, every hero's actions play in the practice room, and AI fights run with no errors.

- [x] Rules: `Creatures` (2024 sheets, `maxUses`, `shortRest`, Expertise), `Actions` (the changed spells, `fireBreathLine`, `goblinDagger`, `goblinThrow`; `choose`, `spellAbility`, `leap`, `smite`, heal `plus`), `Conditions` (drowsy, vexed, sapped; `incapacitated`, `sleeping`, `canOpportunity`; foreseen and Sleep's 10-round timer gone), `Rules` (mastery, Savage Attacker, advantage damage, Sleep's two saves, `sleepAgain`).
- [x] Combat: one slotted spell a turn (`turn.slotSpell`), Divine Smite paid on a hit, the orb's leap, Sleep's second save at the end of the drowsy creature's turn, incapacitated creatures lose their turn and concentration, Alert on initiative, Vex and Sap on the odds. AI: casters whose only melee is a touch spell keep their distance.
- [x] Effects: new Sleep, Acid Splash, Poison Spray, Chill Touch, True Strike (a staff swing, the `staff` blade), Inflict Wounds (damage lands on a save too), and hidden `chromaticOrbLeap`, `fireBreathLine`, `goblinDagger`, `goblinThrow`.
- [x] Checked: 83 rules tests (23 new); every action of every hero in the practice room, from range and next to the goblin, no errors; Divine Smite's slot on a hit only and the one-slot rule with the practice refill off; the orb leaping to a second goblin; Sleep's second save both ways and a hit waking the sleeper; 14 AI fights on `fight.html` and 12 bigger ones (three heroes against goblins, the boss, and a minion), no errors.
- [ ] Not checked: by hand with the mouse; a full play of "The Cellar Key".

**As built:** simplifications kept or added (docs/rules.md section 7): Divine Smite is one button (an attack that smites if it hits) rather than a choice after the hit; an incapacitated creature also doesn't move; Magic Initiate's free cast once a day isn't built (its spell uses slots); cantrips don't grow at level 5 yet (Step 12); Heroic Inspiration, the 2024 Exhaustion, Nick, the boss's Redirect Attack, Lay on Hands, Divine Spark aren't built yet. Thunderwave stays all round the caster (the user's call). Hypnotic Pattern is a 30 ft cube in SRD 5.2.

## Step 7e: Six more spells (the medium batch, 2024 text)

**Goal:** six spells from the user's list that each need a new rule, built on the SRD 5.2 text: Mage Armor (1st), Hold Person, Mirror Image, Flaming Sphere (2nd), Hypnotic Pattern, Haste (3rd). Like Step 7c, they go in the practice room (the wizard, and Hold Person for the cleric too); the adventure's level 1 heroes keep their spells until spell choice (Step 12).

- **Mage Armor:** touch, a creature wearing no armor (the wizard): AC 13 + Dex (12 → 15). Lasts 8 hours, so the whole fight; no concentration.
- **Hold Person:** a Humanoid within 60 ft, WIS save or Paralyzed (incapacitated, speed 0, fails STR and DEX saves, attacks against it have advantage, a hit from within 5 ft is a crit). It saves again at the end of each of its turns. Concentration. In the 2024 rules goblins are Fey, so it works on cultists and people, not goblins, skeletons, or slimes.
- **Mirror Image:** three duplicates. Each time an attack roll hits the caster, a d6 per duplicate: any 3 or higher, a duplicate is hit instead and destroyed. Not concentration. Creatures with blindsight (the slime) aren't fooled.
- **Flaming Sphere:** a 5 ft ball of fire on a free square within 60 ft. Anyone (friend or foe) who ends a turn within 5 ft of it makes a DEX save, 2d6 fire, half on a save. A bonus action rolls it up to 30 ft; rolled into a creature, that creature saves and the sphere stops. Concentration; it lights the room.
- **Hypnotic Pattern:** a 30 ft cube (6 × 6 squares) within 120 ft. Everyone inside who can see it, friends too, makes a WIS save or is charmed: incapacitated, speed 0. Any damage or a friend's shake ends it. Elves have advantage (Fey Ancestry); the slime is immune to charm. Concentration. A cube, as the SRD 5.2 says (the user's call: keep the cube).
- **Haste:** a willing creature within 30 ft: speed doubled, +2 AC, advantage on DEX saves, and an extra action each turn for one weapon attack, Dash, or Disengage. When the spell ends, the creature is incapacitated until the end of its next turn. Concentration.
- **Practice room:** pick the opponent too (a goblin, three goblins, a cultist, a skeleton), so Hold Person has a Humanoid to hold and the area spells have a group.

**Done when:** each plays in the practice room with these rules, and in the lab; the rules tests cover each new rule.

- [x] Rules: `Actions` rows (kinds `condition` and `sphere`; `only` and `Actions.fits`; areas `cube` and `roll`; `sphereMove`, `sphereBurn`), `Conditions` (paralyzed, entranced, hasted, lethargic, mageArmor, mirrored, sphere; `helpless`, `shakeable`, `why`, `release`; `next` durations; Haste's lethargy left by `drop`), `Rules` (`condition`, the Mirror Image roll in attacks, rays, and Shield, `repeatSave`, advantage on saves for Haste and Fey Ancestry, paralyzed failing STR and DEX saves). Sheets: heroes and the cultist are humanoid, the wizard `unarmored`, the slime immune to charm with blindsight.
- [x] Combat: the cube; Haste's action (`turn.haste`, spent first, Dash and Disengage too, a ⚡ pip); the sphere (cast on a spot, Roll the sphere as a bonus action that shows when there's one, burning at turn ends); saves at the end of turns; Shake awake on a charmed friend; damage ending the pattern; duplicates lost; a hit from next to a paralyzed creature is a crit; a concentration spell that takes hold of no one ends. The AI uses Haste's action for one more attack and aims cubes like circles.
- [x] Effects: all six in the lab, plus hidden `mirrorImageHit` and `sphereBurn`; `Shapes.fireBall` and `Fx.keep` for the lasting sphere; `Figures` draws the duplicates.
- [x] Practice room: the six spells (the wizard has 24 now, the cleric Hold Person and 2nd-level slots), an "Against" picker (a goblin, three goblins, a cultist, a skeleton; remembered as `dnd-game:practice-foe`), smaller action buttons that scroll instead of covering the room.
- [x] Checked: 110 rules tests (27 new); in the practice room by script: Hold Person on the cultist (advantage, a crit from next to it, the save at the end of its turn, ending at once when saved), Mage Armor (AC 15), Mirror Image (a goblin's sling hit a duplicate), Flaming Sphere (cast, rolled into the cultist, burning it at the end of its turn), Hypnotic Pattern on three goblins (all charmed; a hit snapped one out), Haste (speed 60, AC +2, the extra action refused a spell and took a Dash, the lethargy lasting through the wizard's next turn); the six effects in the lab under dice / hit / miss / crit (24 runs) and the two hidden ones; 14 AI fights on `fight.html` (all won) and 10 bigger ones (three heroes against five goblins with the boss: 6 won, 4 lost), none stuck, no errors.
- [ ] Not checked: by hand with the mouse (aiming the cube and rolling the sphere with clicks).

**As built:** simplifications in docs/rules.md section 13: Mage Armor and Mirror Image last the fight; the sphere doesn't block movement or jump pits; Haste's extra action and speed start on the creature's next turn; Hide and Utilize aren't built. The AI-played heroes don't have these spells (they're practice-room spells until spell choice, Step 12).

## Step 10a: Level 2 (user request: the levels one by one, up to 5)

**Goal:** everything level 2 gives each hero, from the SRD 5.2 class tables, usable in fights; a level picker on `fight.html` and in the practice room to try it. Levels come from `Creatures.LEVELS` (one table per level, so 3–5 just add rows).

- **Fighter:** Action Surge (one more action on your turn, not a Magic action, once per short rest); Tactical Mind (a failed ability check can spend a Second Wind for +1d10; the use is kept if it still fails).
- **Wizard:** a third 1st-level slot, a fifth prepared spell (Chromatic Orb), Scholar (Expertise in Arcana). Arcane Recovery, a level 1 feature not built until now: on a short rest, slots back up to half the level (rounded up), once per long rest.
- **Cleric:** a third 1st-level slot, a fifth prepared spell (Inflict Wounds), Channel Divinity twice (one back on a short rest): Divine Spark (30 ft, another creature: heal 1d8 + Wis, or a CON save against 1d8 + Wis radiant or necrotic, half on a save) and Turn Undead (undead within 30 ft: WIS save or frightened and incapacitated for 1 minute, fleeing; damage ends it).
- **Rogue:** Cunning Action: Dash, Disengage, or Hide as a bonus action. Hide: a DC 15 Stealth check, only out of every enemy's sight (walls, pillars, crates); hidden, attacks against you have disadvantage and yours advantage; it ends when you attack or cast, or an enemy who can see you has a passive Perception at least your check.
- **Paladin:** Fighting Style: Blessed Warrior (Sacred Flame with Charisma; Guidance isn't built); Paladin's Smite (one Divine Smite a long rest without a slot); two more prepared spells (Cure Wounds, Shield of Faith).
- **Everyone:** more HP and a hit die (built). The AI fighter uses Action Surge for another attack; the AI cleric turns undead and sparks a friend back up.

**Done when:** at level 2 on `fight.html` and in the practice room, each hero uses their new features; the rules tests cover each one.

- [x] Rules: `Creatures.LEVELS[2]` and a general `levelUp` (slots, uses, actions, traits, Expertise; `maxSlots`), Arcane Recovery in `shortRest`, the rogue's sheet actions; `Actions` (`actionSurge`, `divineSpark`, `divineSparkHeal`, `hide`, Turn Undead as a 30 ft aura using Channel Divinity; `others`, `free`, save `plus`, cost `free`); `Rules` (`surge`, `hide`, the turned condition, Tactical Mind in `check`, a picked type on saves); `Conditions` (turned, hidden).
- [x] Combat: Action Surge after the action; Paladin's Smite first; Hide only out of sight (`Squares.sight` with cover), hidden's advantage and disadvantage, found by passive Perception; Cunning Action Dash ◆ and Disengage ◆ buttons; turned creatures flee (`CombatAI.flee`) until hurt; the AI uses Action Surge and turns undead, and skips hidden targets. Tactical Mind through `Explore.rollCheck`.
- [x] Effects: `actionSurge`, `divineSpark` (in the picked type's colors), `divineSparkHeal`, `hide`; Turn Undead no longer slides the figures (they flee on their turns).
- [x] Level pickers: the practice room (Level 1–2, remembered as `dnd-game:practice-level`) and `fight.html` (Heroes at Level 1–2).
- [x] Checked: 125 rules tests (15 new); in the practice room by script at level 2: the fighter's Action Surge (refused before the action, a second swing, used up), the rogue hiding behind a pillar (refused in the open; hidden on 19), a bonus Dash, and a stab with advantage that ended it; the cleric's Divine Spark (necrotic picked, the type buttons), Turn Undead on the skeleton (it fled 5 squares on its turn and stopped when hurt), heal refused with no other ally; the paladin's free smite, then a slot one; in the adventure, Arcane Recovery on a short rest and Tactical Mind spending a Second Wind; the lab (5 effects × 4 outcomes); 10 AI fights on `fight.html` at level 2 and 8 with three level 2 heroes against three skeletons and two goblins: all won, none stuck, no errors (Action Surge in 16, Turn Undead in 5).
- [ ] Not checked: by hand with the mouse; Divine Spark's heal in a fight (the practice room has one hero; the AI heals with slots first).

**As built:** level 2 is reached in "The Cellar Key" at its end, as before; the pickers are how to play it now. Simplifications in docs/rules.md section 14. Lay on Hands (a paladin level 1 feature) is still Step 9's.

## Step 10b: Level 3 (subclasses)

**Goal:** level 3 from the SRD 5.2: each hero's subclass and what comes with it, usable in fights and in the practice room's level picker.

- **Fighter (Champion):** Improved Critical (weapon attacks crit on 19–20); Remarkable Athlete (advantage on initiative and Athletics checks; after a crit, up to half its speed of movement that provokes no opportunity attacks). 28 HP.
- **Wizard (Evoker):** slots 4 / 2; Scorching Ray prepared (the sixth; Evocation Savant's two free spellbook spells don't change what's prepared); Potent Cantrip (a damaging cantrip that misses, or is saved against, still does half its damage, with no other effect).
- **Cleric (Life Domain):** slots 4 / 2; Disciple of Life (a healing spell cast with a slot heals 2 + the slot level more); Preserve Life (Channel Divinity: 15 HP shared among bloodied friends within 30 ft, the caster too, none above half its HP maximum); domain spells always prepared: Aid (up to three creatures: +5 HP maximum and HP), Lesser Restoration (a bonus action touch: ends paralysis), Bless, Cure Wounds; and Spiritual Weapon (2nd: a bonus action, concentration in 2024: a spectral weapon appears and makes a melee spell attack, 1d8 + Wis force; a bonus action on later turns moves it 20 ft and attacks again).
- **Rogue (Thief):** Sneak Attack 2d6; Steady Aim (a bonus action if it hasn't moved: advantage on its next attack this turn, then speed 0); Fast Hands and Second-Story Work don't come up in fights (lock picking is Step 9's).
- **Paladin (Oath of Devotion):** a third 1st-level slot; Channel Divinity twice: Sacred Weapon (free with an attack: + Cha to attack rolls with the longsword, which glows) and Divine Sense (not built: nothing to find in these fights); oath spells always prepared: Protection from Evil and Good (touch, concentration: fey, undead, fiends... attack the warded creature with disadvantage) and Shield of Faith.

**Done when:** each hero's level 3 features play at level 3 in the practice room and in AI fights on `fight.html`, and the rules tests cover each one.

- [x] Rules: `Creatures.LEVELS[3]` (and `sneak` in a level row); `Actions` (`cantrip` on the 8 cantrips; `steadyAim`, `spiritualWeapon`, `spiritualStrike`, `preserveLife`, `aid`, `lesserRestoration`, `sacredWeapon`, `protectionFromEvil`; `summon`, target `bloodied`, `ends`); `Rules` (critical range, Potent Cantrip on attacks and saves, Disciple of Life, `preserve`, `aid`, `restore`, spell damage `plus`, Sacred Weapon's bonus, Remarkable Athlete on Athletics); `Conditions` (aiming, aided taken off by `clear`, warded, sacredWeapon, spiritual).
- [x] Combat: Remarkable Athlete's initiative and free movement (`turn.freeMove`); Steady Aim (no moving first, speed 0 after); the Spiritual Weapon placed next to its target and flown to the next one (a conditional ◆ button); Preserve Life's bloodied group; Aid's HP maximum; Lesser Restoration ending paralysis (and the caster's concentration with it); Protection from Evil's disadvantage; Sacred Weapon's glow (a figure light). The AI cleric uses Preserve Life when two friends are bloodied.
- [x] Effects: `spiritualWeapon` (and hidden `spiritualStrike`), `preserveLife`, `aid`, `lesserRestoration`, `protectionFromEvil`, `sacredWeapon`, `steadyAim`; `Shapes.spectralWeapon` (a floating gold hammer while it lasts).
- [x] Checked: 143 rules tests (18 new: crit rates 10% / 5%, Potent Cantrip on a miss and a save, Preserve Life's split, Aid going away, Sacred Weapon's +7...); in the practice room at level 3 by script: the cleric's Spiritual Weapon cast and flown to the third goblin, Preserve Life (3 → 13, half of 27), Aid (27 → 32); the paladin's Sacred Weapon (glowing, +7 to hit) and Protection from Evil (the goblin's spear at disadvantage); the rogue's Steady Aim (refused after moving); the wizard's Potent Cantrip on a missed Fire Bolt; the lab (7 effects × 4 outcomes); 10 AI fights on `fight.html` at level 3 and 8 with three level 3 heroes against three skeletons, the boss and two goblins: all won, no errors (Improved Critical in 6, Remarkable Athlete in 9, Potent Cantrip in 17, Disciple of Life in 7).
- [ ] Not checked: by hand with the mouse; Preserve Life and Lesser Restoration chosen by the AI in a fight (never needed in these).

**As built:** simplifications in docs/rules.md section 15. Divine Sense, Fast Hands, Second-Story Work, and Evocation Savant's spellbook have nothing to do in fights yet. The spectral hammer floats in the square next to its target.

## Step 10c: Level 4

**Goal:** level 4 from the SRD 5.2: everyone's Ability Score Improvement (the SRD's general feats are only that and Grappler), and what the class tables add.

- **Ability Score Improvement:** +2 to each hero's main ability: Fighter Str 19, Wizard Int 19, Cleric Wis 19, Rogue Dex 19, Paladin Str 19. Everything that comes from it goes up with it (`Creatures.improve`): weapon attacks and damage (+1), spell attack and DC (+1: 6 and 14), healing (+1), the rogue's AC (15), saves, skills, initiative.
- **Fighter:** Second Wind three times.
- **Wizard:** slots 4 / 3; a fourth cantrip (Acid Splash); a seventh prepared spell (Misty Step).
- **Cleric:** slots 4 / 3; a fourth cantrip, Spare the Dying (15 ft: a creature at 0 HP becomes stable); a seventh prepared spell (Hold Person).
- **Rogue, Paladin:** just the Ability Score Improvement (the paladin's fifth prepared spell has nothing built to choose from).

**Done when:** at level 4 the numbers on every sheet match the SRD (checked by the rules tests), Spare the Dying stabilizes a fallen friend, and AI fights run clean.

- [x] Rules: `Creatures.LEVELS[4]` with `improve`; `Creatures.improve` (weapons' `ability`, `acDex`, the spell numbers; never past 20); `spareTheDying` (kind `stabilize`, `only: 'dying'`).
- [x] Combat: Spare the Dying makes a fallen hero stable (no more death saves); the AI cleric uses it when it has no healing left. Effect `spareTheDying` (gold motes, STABLE).
- [x] Checked: 151 rules tests (8 new: every level 4 sheet's numbers, the cap at 20, Spare the Dying's target); the practice room at level 4 for all five heroes (the sheets as the table in classes.md); Spare the Dying on a fallen fighter in a fight on `fight.html`; the lab (4 runs); 10 AI fights on `fight.html` at level 4 and 8 with three level 4 heroes against three skeletons, two goblin bosses and a goblin: all won, no errors (Spare the Dying and Preserve Life once each).
- [ ] Not checked: by hand with the mouse.

## Step 10d: Level 5

**Goal:** level 5 from the SRD 5.2, the big jump: proficiency +3, Extra Attack, 3rd-level spells, stronger cantrips.

- **Everyone:** proficiency bonus +3: weapon attacks, spell attack and DC, the breath DC go up by 1 (saves and skills already follow the level).
- **Cantrips grow:** Fire Bolt 2d10, Ray of Frost 2d8, Shocking Grasp 2d8, Acid Splash 2d6, Poison Spray 2d12, Chill Touch 2d10, Sacred Flame 2d8, True Strike +1d6 radiant, Spare the Dying 30 ft; the dragonborn breath 2d10, three uses.
- **Fighter:** Extra Attack (the Attack action is two attacks; Action Surge makes it four); Tactical Shift (Second Wind also gives half its speed of movement with no opportunity attacks).
- **Wizard:** slots 4 / 3 / 2; Fireball and Haste prepared (nine prepared). Memorize Spell has no use in fights.
- **Cleric:** slots 4 / 3 / 2; Sear Undead (Turn Undead also does 4d8 radiant to each undead that fails, without ending the turning); Spirit Guardians (3rd, concentration: spirits in a 15 ft emanation round the cleric; enemies that enter it, are swept into it, or end a turn in it make a WIS save, 3d8 radiant, half on a save, once a turn each; their speed is halved there); Life Domain spells at 5: Mass Healing Word (a bonus action: up to six friends heal 2d4 + Wis) and Revivify (touch a friend who died this fight: back with 1 HP).
- **Rogue:** Sneak Attack 3d6; Cunning Strike (give up a Sneak Attack d6 for Poison: a CON save or poisoned, a save at the end of each turn; Trip: a DEX save or prone; Withdraw: half its speed of movement with no opportunity attacks); Uncanny Dodge (a reaction: an attack that hits does half). New conditions: poisoned (disadvantage on attacks and checks) and prone (its attacks at disadvantage; attacks from next to it at advantage, from farther at disadvantage; getting up costs half its movement).
- **Paladin:** Extra Attack (the breath can stand in for one of the attacks); slots 4 / 2; Aid prepared (an oath spell at 5). Faithful Steed is not built.
- Also: the Luck reroll's log text (it named the other die of a disadvantage roll as the rerolled one).

**Done when:** at level 5 every hero's new features play in the practice room and in AI fights on `fight.html`, and the rules tests cover each one.

- [x] Rules: `Creatures.LEVELS[5]` and proficiency +3 in `levelUp`; `Actions.at` and `upgrade` on the 8 cantrips, Spare the Dying, and the breath; `spiritGuardians`, `guardiansBurn`, `massHealingWord` (`hurt`), `revivify` (kind `revive`, `only: 'dead'`); `Rules` (Cunning Strike, Uncanny Dodge, Sear Undead, several heal targets, poisoned on checks, a stored DC for repeat saves, the Luck log text); `Conditions` (guardians, poisoned, prone).
- [x] Combat: Extra Attack (`turn.extra`, the breath as one of the attacks), Tactical Shift and Withdraw (`freeMove`), Uncanny Dodge (the reaction, DODGE), Cunning Strike (a choice row under Sneak Attack), prone (advantage next to it, disadvantage farther, getting up for half the movement) and poisoned (disadvantage), Spirit Guardians (entering, being reached, ending a turn; half speed; `Shapes.guardians`), Mass Healing Word's group, Revivify on the dead. The AI makes its second attacks, casts Spirit Guardians with two enemies close, Revivifies a dead friend, and uses Mass Healing Word when two are badly hurt.
- [x] Effects: `spiritGuardians` (and hidden `guardiansBurn`), `massHealingWord`, `revivify`; Turn Undead shows Sear Undead's damage.
- [x] Fixed: Revivify spent its slot on a dead target and did nothing (the attack loop skipped the dead).
- [x] Checked: 167 rules tests (16 new: every level 5 number, cantrip dice, Sear Undead, Cunning Strike rates, Uncanny Dodge, Revivify, the Luck text); in the practice room at level 5 by script: the fighter's four attacks with Action Surge and Tactical Shift, the rogue's Trip (the goblin prone, getting up next turn) and Uncanny Dodge (4 → 2), Spirit Guardians striking three goblins, Mass Healing Word (10 → 24), Sear Undead (12 radiant, still turned), the paladin's breath then a sword swing in one Attack action; Revivify in a fight on `fight.html`; the lab (17 runs); 8 AI fights at level 5 on `fight.html` and 8 with three level 5 heroes against four skeletons, two goblin bosses and a goblin, all won, no errors (Fireball in 5, Spirit Guardians in 6); 10 fights at level 1 still clean.
- [ ] Not checked: by hand with the mouse; Mass Healing Word and Revivify chosen by the AI in a fight.

**As built:** simplifications in docs/rules.md section 17. Faithful Steed and Memorize Spell aren't built. Levels 2–5 are done: the heroes reach level 2 in "The Cellar Key"; levels 3–5 are for `fight.html`, the practice room, and the second adventure.

## Step 8: Save and continue

**Goal:** close the page in the middle of the cave, open it again, press Continue, and carry on.

- A title screen on `adventure.html`: Continue (when there's a save), New game.
- One autosave slot in `localStorage` (`dnd-game:save`, in `try/catch`), written on entering a map, after a fight is won, and after a talk ends. Not mid-fight: a reload during a fight restarts it from its checkpoint, as a loss does now.
- What's saved: the adventure, the current map and where each hero stands; each hero's HP, slots, uses, hit dice, level, and death saves; the bag (gold, potions); flags; each visited map's state (doors, locks, traps found or sprung, chests opened, the dead, rooms seen); the dice seed and how far it has rolled.
- The save has a version number; a save from an older version is refused with a message, not half-loaded.

**Done when:** a save made after the guard fight, with the door forced and the trap sprung, reloads with all of that as it was, and the rest of the adventure plays on from there.

## Step 9: Rogue and Paladin in the party

**Goal:** all five heroes are playable; the party is four.

- Rogue: Sneak Attack as a real rule (once a turn, with advantage or an ally next to the target), the thrown dagger, Expertise. Thieves' tools: the rogue can pick the storeroom lock (DEX DC 12) instead of forcing it.
- Paladin: Lay on Hands (a pool of 5 HP per level, a bonus action, refills on a long rest). The fire breath (1d10, a 15 ft cone or a 30 ft line, twice a long rest) and Divine Smite are built (Step 7d).
- Choosing the party at New game (see the open decision on party size), and the cave's fights sized for it ([monsters.md](monsters.md) "Encounter sizing"): more goblins for four heroes than for three.
- `fight.html` can use any two heroes.

**Done when:** a party with the rogue and the paladin plays "The Cellar Key" to the end: the rogue picks the lock, the paladin breathes fire on the guards.

## Step 11: The second adventure

**Goal:** a second adventure, started from the end of the first: same party, same gold, level 2.

- Draft: "The Restless Crypt". Millbrook's dead are walking at night; the trail leads to a crypt under the old chapel: skeletons, a slime in the drains, and a cultist raising them. The undead are where Turn Undead and Divine Smite shine. (Story to agree with the user.)
- The crypt from the editor's dungeon generator, with things placed by room (the guard room, the shrine) instead of by hand-picked squares; or built by hand like the cave if that's simpler.
- A use for gold: a shop in Millbrook (potions, maybe an item or two).
- Night in Millbrook (the editor's time of day) for the opening.
- Ends with level 3 listed, like the first ends with level 2.

**Done when:** "Continue" after "The Cellar Key" leads into the new adventure with the party as it was, and it plays to its end.

## Later (not ordered)

- **Fog of war:** unexplored rooms dark until seen (the editor's parked plan, `../map-editor/fog-of-war.md`).
- **Conditions and more spells:** Sleep, Bless, Burning Hands, Ray of Frost, Guiding Bolt; prone, frightened, restrained.
- **Stealth and surprise:** sneak past or ambush a group.
- **Inventory:** items beyond potions; keys as items.
- **Hills:** draw the generator's elevation instead of flattening it.
- **AI DM:** Claude describing rooms and playing the townsfolk (needs a server; optional add-on, [vision.md](vision.md) section 6).
- **Friends:** each player runs one hero.
- **Sound.**
- **Character creation.**

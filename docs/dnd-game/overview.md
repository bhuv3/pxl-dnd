# D&D game: main doc

A turn-based fantasy game that plays like Dungeons & Dragons: a party of heroes explores maps, rolls dice, talks to people, and fights monsters on a square grid. It is built on the Pixel Map Editor (`map-editor/`), which already draws the maps, lights, characters, and monsters.

**Working title:** none yet. The folder is `dnd-game/`.

This file is the entry point. It holds what every session needs. Paths in backticks are from the repo root unless they start with `js/`, `css/` or `img/` (inside `dnd-game/`). Details live in the topic docs below: **read only the ones the current task needs.**

**Status:** Steps 1–5 are built: the effects lab (`dev/dnd-game/fx-lab.html`), one fight (`fight.html`), and the first adventure, "The Cellar Key" (`adventure.html`: the village, the innkeeper, the goblin cave, back for the reward and level 2). Step 6a is built too: the adventure editor (`adventure-editor.html`), which makes adventures on map editor maps and exports the file `adventure.html?a=<id>` plays. Step 7 is built too: eight more spells (Ray of Frost, Burning Hands, Thunderwave, Sleep, Guiding Bolt, Inflict Wounds, Bless, Shield of Faith) with conditions, concentration, and aiming areas on the grid, and a practice room (`practice.html`) to try every hero's attacks and spells on enemies that can't die (a goblin, three goblins, a cultist, or a skeleton; the wizard has 24 spells there). Distances use Pythagoras. Step 7d switched the whole game to the 2024 rules (SRD 5.2): spells, hero sheets, species, feats, weapon mastery, monsters, and the credit line. Step 7e added six spells on the 2024 text (Mage Armor, Hold Person, Mirror Image, Flaming Sphere, Hypnotic Pattern, Haste). Step 10a built level 2 for all five heroes (Action Surge, Channel Divinity, Cunning Action and Hide, Paladin's Smite...), with a level picker in the practice room and on `fight.html`; Step 10b built level 3 and the subclasses (Champion, Evoker, Life Domain, Thief, Devotion); Step 10c level 4 (Ability Score Improvements, Spare the Dying); Step 10d level 5 (Extra Attack, 3rd-level spells, Spirit Guardians, Cunning Strike, stronger cantrips).md). Step 6b is dropped.

---

## 1. Topic docs

| Doc | What's in it | Read it when |
|---|---|---|
| [vision.md](vision.md) | What the game is, the core loop, exploration vs combat, the party, who the DM is | Making a design decision, or unsure what the game should feel like |
| [roadmap.md](roadmap.md) | The baby steps in order, each with a checklist and "Done when" | Starting or finishing a step |
| [effects.md](effects.md) | Fight animations: poses, spell effects, hit feel, dice, timing, the spell data format | Working on any animation or visual effect (Step 1) |
| [rules.md](rules.md) | The dice rules: abilities, checks, attacks, damage, turns, conditions, rests, levels | Writing rules code, or any number in the game |
| [classes.md](classes.md) | Fighter, Wizard, Cleric, Rogue, Paladin (and Dragonborn): features and spells, levels 1–5 | Adding or changing a class, spell, or ability |
| [monsters.md](monsters.md) | Skeleton, goblin, slime, cultist: stat blocks and how they fight | Adding or changing a monster |
| [combat.md](combat.md) | How combat runs in the game: starting a fight, turn flow, grid movement, targeting, monster turns | Building the combat mode |
| [adventures.md](adventures.md) | Adventures made in the editor: encounters, triggers, chests, locks, traps, dialogue, the file format | Building adventure content or the editor additions |
| [map-editor-reuse.md](map-editor-reuse.md) | Which editor modules the game loads, their APIs, the world data, scale, gotchas | Writing code that touches the map editor's modules |

Keep this table up to date when a doc is added, renamed, or split.

---

## 2. Decisions made

| Topic | Decision |
|---|---|
| Kind of game | Plays like D&D: party, d20 rolls, classes, spells, monsters with stat blocks, turn-based combat on a grid. |
| Engine | Reuse the map editor's rendering (maps, lights, characters, monsters). Don't rewrite what exists. |
| Project | Its own folder, `dnd-game/`, next to `map-editor/`. Its own pages; the editor stays an editor. `dnd-game/` holds only what the game loads when it runs; docs, developer pages, tests, tools, art sources and sample data live in the top-level folders (section 5). |
| Way of working | Baby steps. One small step at a time, each finished and checked before the next. |
| First step | An effects lab (`dev/dnd-game/fx-lab.html`): spells and attacks animated on a small dungeon room, before any game rules. |
| Docs | This file (`docs/dnd-game/overview.md`) is the index. Topic docs hold the details, next to it in `docs/dnd-game/`. Update the docs in the same change as the code. |
| Adventure editor | Its own page, `adventure-editor.html`, in `dnd-game/`; the map editor stays unchanged. Built before saving (Step 6, at the user's request), placing things first (6a), dialogue (6b) after Step 7. |
| More spells | Step 7, before saving and before 6b (the user's call): eight level 1 spells and the rules they need. |
| Order after Step 7e | Levels 2–5 one at a time (Steps 10a–10d), then saving, the party of four, the second adventure. Step 6b (dialogue in the editor) is dropped (the user's call). |
| Rendering | The game draws on the editor's WebGL framework (`docs/map-editor/gl-renderer.md` section 12): the map frame through `Stages` and GL passes, and the screen layer (figures, effects, text, dice tray) through `GlScreen`, a Canvas 2D compatible GL context, so the drawing code runs unchanged. The CPU path stays as the reference and fallback (`?gl=0`; `?screen=2d` keeps a 2D display). A page whose overlay needs paths, strokes or dashes (the adventure editor) passes `{ screen: '2d' }` to `Stage.init`. |
| Rules edition | The 2024 rules, through the SRD 5.2 (the user's call, Step 7d): check numbers against the SRD 5.2 text, not the 2014 rules. House rules kept: Pythagoras distances, Thunderwave all round the caster. |

## 3. Open decisions (ask the user; don't assume)

| Question | Options | Recommended |
|---|---|---|
| Solo or with friends? | One player controls the whole party / friends each play one hero | Solo first |
| Who is the DM? | The game (adventures made in the editor) / Claude as an AI DM / a human DM with a player screen | The game first; AI DM later |
| How close to the 2024 rules? | Close to the real rules / simplified for speed | Close, with the simplifications listed in [rules.md](rules.md) |
| Exploration | Real-time walking (like Play mode today) / turn-based everywhere | Real-time; switch to turns when a fight starts |
| Spell aiming | Keyboard only / mouse to pick targets and squares | Mouse for targets, keyboard for walking |
| Reuse map editor code | Load scripts from `../map-editor/js/` / copy them in | Load them (one source of truth); Step 1 is built this way. See [map-editor-reuse.md](map-editor-reuse.md) |
| Party size (Step 9) | Fixed four / pick 3 or 4 of the five at New game | Pick 4 of 5 at New game |
| Saving (Step 8) | One autosave slot / several named slots | One autosave slot first |
| Second adventure (Step 11) | "The Restless Crypt" (undead under the chapel) / another story | The crypt: it uses the skeletons, slime, cultist, and Turn Undead that already exist |

When the user decides one, move it to section 2 and update the topic doc.

---

## 4. Technical rules

Same rules as the map editor (`docs/map-editor/plan.md` section 3), so the two can share code.

1. **Opens by double-clicking the HTML file.** No server, no build step. Browsers block ES modules and Web Workers on `file://`, so:
   - Plain `<script src="...">` tags in a fixed order.
   - Each file defines one module object as a top-level `const`:
     ```js
     // Dice rolls and notation.
     const Dice = (() => {
       function roll(notation, rng) { ... }
       return { roll };
     })();
     ```
   - No other globals.
2. **No dependencies.** Plain HTML, CSS, and JavaScript.
3. **Deterministic drawing.** Same data, same picture. Use the editor's `Random.hash` / `Random.makeRng(seed)` for anything visual. Dice rolls use their own seeded RNG so a fight can be replayed.
4. **Naming:** `camelCase` functions and variables, `UPPER_CASE` constants, `PascalCase` module objects.
5. **Comments:** one brief line above each function or block saying what it does. No long explanations; split the function instead.
6. Keep functions short and modules small.
7. Wrap every `localStorage` call in `try/catch`.
8. **Images:** a canvas can't read pixels from image files on `file://`. Art is drawn in code, or packed into JS as data URLs (the editor's `tools/map-editor/pack_character.py`).
9. **Game rules stay apart from drawing.** Rules modules (dice, stats, combat) never touch a canvas; effects modules never decide an outcome. Combat decides what happened, then asks effects to show it.

## 5. Folder layout

`dnd-game/` holds only what the game's pages load:

```
dnd-game/
  adventure.html     Step 5: plays an adventure (css/adventure.css, js/adventure/); ?a=<id> plays adventures/<id>.js
  adventure-editor.html  Step 6: makes adventures (css/editor.css, js/editor/)
  fight.html         Step 4: one fight (css/fight.css, js/fight.js)
  practice.html      Step 7b: try every attack and spell of a chosen hero on a chosen enemy (css/practice.css, js/practice.js)
  adventures/        Adventure data files: cellar-key.js (adventures.md section 4)
  js/
    stage.js         Stage: frame loop over the editor's render modules, with floor / lights / screen hooks
    figures.js       Figures: characters in their poses, with flash, outline, fading, health bars, lit by the floor
    art/heroes.js    Heroes: the five heroes drawn in code on one rig, every pose
    art/poses.js     Poses: which pixels a figure shows (hero poses, monsters leaned)
    fx/              Effects (effects.md section 8): fx, spells, looks/ (each spell's look after its 2024 text), projectiles, blades, shapes, glow, volumes, arcs, particles, marks, deaths, popups, palette
    ui/diceTray.js   DiceTray: the animated d20
    rules/           Dice, Creatures (sheets and stat blocks), Actions, Conditions (asleep, Bless, concentration...), Rules.resolve (rules.md)
    combat/          Squares (grid), Combat (turn loop), CombatAI, GridOverlay, CombatInput (the player's fight controls)
    adventure/       Adventures (registry), Maps (build from data), Explore (walking, doors, traps, chests, people, exits, rests),
                     Dialogue (the talk box), Adventure (the page: maps, travel, fights, the end)
    ui/combatUI.js   CombatUI: turn order bar, action bar, log, result screen
    editor/          AdvFile (new, read, write, add maps, play), EditorView (map, marks, mouse), EditorPanel (forms), Editor (tools, problems)
```

Everything else is at the top of the project:

```
docs/dnd-game/       This file and the topic docs (section 1)
dev/dnd-game/        Developer pages, not part of the game:
  fx-lab.html        Step 1: effects lab (lab.js: the room, the cast, the panel; lab.css)
  gltest.html        Map frame GL parity test (glscenes.js)
  gltest-screen.html GlScreen parity test (screen-parity.js, screen-tape.js, screen-hooks.js)
tests/dnd-game/      Node tests: rules-test.js
tools/dnd-game/
  fx-sheet.js        Contact sheet of a spell effect (paste into dev/dnd-game/fx-lab.html)
serve.py             The local server for the whole project (port 8765, no-cache)
```

Add folders as steps need them, and update these trees.

## 6. Running and testing

- Serve the project folder so both projects load: `python3 serve.py` in the repo folder, then open `http://localhost:8765/dev/dnd-game/fx-lab.html`. It's `http.server` plus `Cache-Control: no-cache`, so browsers check every file before using a cached copy. The plain `python3 -m http.server` let browsers keep running old scripts after an edit (a hang reported on the practice page was almost certainly that). A browser that cached files under the old server needs one hard reload (Cmd+Shift+R). 
- **Stepping frames by hand:** `Stage.setManual(true)` stops the loop (and stops refitting on resize); then `Stage.step(1/60)` advances one frame. `Lab.cast` is async (it waits for the dice tray, then the effect) and ignores a new cast while `Lab.busy()`, so pump frames in a loop with an occasional `await new Promise(r => setTimeout(r, 0))` until it's done. Zoom in by setting `Stage.cam.zoom`, `panX`, `panY`, then `Stage.step(0)`.
- **Map frame GL parity:** `http://localhost:8765/dev/dnd-game/gltest.html` (add `?bench=1` for frame costs) steps the lab room, the village (day, night, rain) and the goblin cave through effects and compares the Stage's GL frame with the CPU pipeline on the same state, every stage and the whole frame (target 99.9%); result in `window.__gameGlResult`. `?gl=0&hash=1&baseline=save` then `=check` proves the CPU output unchanged after an edit. Needs no storage.
- **Rules tests:** `node tests/dnd-game/rules-test.js` (no browser). Run it after any change in `js/rules/`.
- **Adventure test:** in `adventure.html`, `Stage.setManual(true)`; on `Explore.on('encounter')` set `Combat.state().auto = true`; call `Explore.click(sx, sy)` along the route and step frames until idle; click `#again` after a loss. The result screen appears 0.9 s of real time after a fight ends.
- **Adventure editor test:** drive it with the page's own handlers: `MouseEvent`s on `#stage` at a square's screen point (`rect.left + cam.panX + (sx * 10 + 5) * cam.zoom`), then mouseup on `window`; set form fields and dispatch `change`. Add a map file by putting a `File` in `#mapFile` through a `DataTransfer`. To play without a download, put `{ data, from }` in `localStorage['dnd-game:play-test']` and open `adventure.html?test=1`. Clear `dnd-game:editor` afterwards so the editor opens fresh.
- **Stepping a fight by hand:** never `await Combat.act(...)` before stepping frames: it resolves only when its effect finishes, which needs `Stage.step`. Start it, then pump frames until it settles.
- **AI fights in tests:** a hero who acts first waits for the player before an `encounter` handler can set `auto`; if `Combat.state().wake` is set, call it once to end that turn.
- **Fight test:** in `fight.html`, `Stage.setManual(true)`, then `Fight.begin({ auto: true, dice: false })` and step `Stage.step(1/20)` until `Combat.state().over`: the AI plays both sides. Step 4 ran 37 such fights with no errors.
- **Sweep test:** for every effect in `Spells.list()` and every outcome: `Lab.reset()`, `Lab.cast(name)`, step until not busy; catch errors. Step 2a's sweep was 120 runs with no errors.
- In the in-app browser, `img.decode()` (the elf wizard's art) can hang until a screenshot is taken, and a screenshot can resize the canvas. Take one screenshot after loading, before testing. Reload with the navigate tool, not `location.reload()`, so the next command runs on the new page.
- After editing JS, a normal reload picks it up with `serve.py`. If a page still behaves like old code, refetch every script with `fetch(src, { cache: 'reload' })` and reload.
- **Nothing freezes the page:** a frame that throws is logged (`Frame failed`) and the loop goes on; an effect step that throws is skipped (`Effect step ... failed`); an action that throws frees the turn. Check the console for these when something looks wrong.
- The in-app browser throttles `requestAnimationFrame` to about 1.5 fps. To check an animation, step it by hand from JS, then screenshot.
- **Protect the editor's autosave.** Anything that loads editor UI code can overwrite `pixel-map-editor:autosave` in `localStorage`. Copy it to another key before a test and restore it after. The game uses its own keys (prefix `dnd-game:`).
- More editor testing notes: `docs/map-editor/plan.md` section 3.1.

## 7. Scale and units

- 10 map pixels = 1 square = 5 ft (the editor's grid default).
- A character is about 16 map pixels tall and fits one square, like a D&D token.
- Speed 30 ft = 6 squares a turn.

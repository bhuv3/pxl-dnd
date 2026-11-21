# Adventures

Back to [overview.md](overview.md). Built from [roadmap.md](roadmap.md) Step 5 on.

An adventure is a map made in the editor plus the story placed on it: who is where, what happens when you step somewhere, what's locked, hidden, or trapped, and who says what. The game is the DM and runs it ([vision.md](vision.md) section 6).

**Status:** built (Steps 5a, 5b, 6a). "The Cellar Key" is the data file `adventures/cellar-key.js`, read by `js/adventure/` (`Adventures`, `Maps`, `Explore`, `Dialogue`, `Adventure`), played on `adventure.html` (`adventure.html?a=<id>` plays `adventures/<id>.js`). Adventures can be made on `adventure-editor.html` (Step 6a: placing things; dialogue editing is 6b). The file calls `Adventures.add({...})` instead of being JSON: browsers block `fetch()` on `file://`, and the game must open by double-clicking.

**The format as built** (the plan below is the wider idea):
- `id` (also the file name), `name`, `start: { map, at }`, `party: [{ name, key, sheet }]`, `quest: [{ if: flag, text }]` (the party panel shows the first whose flag is set; no `if` means always), `end: { title, text }`.
- `maps.<id>`: `name`; one of `map` (a map editor `.json` map packed into the file: `MapModel.serialize` with each layer run-length packed as `"rle:" + base64` when smaller; `Maps.pack` / `Maps.unpack`), `generate: { biome, width, height, seed, settings }` (the editor's generator), or `build: { cols, rows, seed, wall, floors: [[rect, ground]], objects: [[type, x, y]], settings }`; `spots` (arrival points: `{ sq }`, `{ place, offset }` from a placed object like the tavern, or `{ exit, inward }`); `npcs: [{ name, key, role or seed, at, talk (a dialogue id) or line (one line, then Goodbye) }]`; `exits: [{ id, rect | road: 'east', to, at, needs (a flag), refused }]`; `areas: [{ rect | place + radius, text }]`; `monsters: [{ name, key, sheet, seed, sq, group, role }]`; `sight` (default 7); `defeated: { group: [actions] }`; `doors: [{ sq, locked: { skill, dc, text } }]`; `chests: [{ sq, gold, potions }]`; `traps: [{ sq, find, save: { ability, dc }, damage, type, name }]`.
- `dialogue.<id>`: `name`, `start: [{ if: [flags], node }]`, `nodes.<id>: { text, do: [actions], choices: [{ text, check: [skill, dc], pass, fail, next, do }] }`.
- Actions: `['flag', name]`, `['gold', n]`, `['say', text]`, `['levelUp', text]`, `['end']` (the end screen, after the talk or the fight).
- Squares are `[column, row]`; rects `[x0, y0, x1, y1]`, inclusive.
- `map` and `generate` maps are flattened (no hills yet). Characters on them (from the map editor) are dropped: the adventure places its own. A door or chest in the data uses the map's own door or chest on that square, or adds one. The editor brings a map's goblins, skeletons, slimes, cultists, villagers, doors, and chests in as adventure things when the map is added.

Not built from the plan below: trigger areas with action lists (section 2), shops, items beyond potions, keys for doors, editing dialogue in the editor (Step 6b).

---

## 1. Things to place on the map

New object and area types, placed in the editor like props and characters are today.

| Thing | Placed as | Data |
|---|---|---|
| **Party start** | point | facing |
| **Encounter zone** | painted area or rectangle | monsters inside it, `ambush` (yes/no), `wakes` (on sight / on enter / on noise), linked zones that join the fight |
| **Trigger** | painted area | `on`: enter / leave / search / use; `once` (yes/no); actions (below) |
| **Chest / container** | object (the editor's chest, barrel, crate) | loot list, `locked` DC, `trapped` (trap id) |
| **Locked door** | the editor's door | `lock` DC (Thieves' Tools or Str check to force), key item id |
| **Hidden door** | wall segment with a door | `hidden` DC (passive Perception or Investigation finds it) |
| **Trap** | painted area or point | `find` DC (Perception), `disarm` DC (Thieves' Tools), effect (dart: +5 to hit, 1d10 piercing; pit: Dex save DC 12, 2d6 bludgeoning; fire jet: Dex save DC 13, 2d10 fire) |
| **Person** | the editor's villagers | name, dialogue id, `shop` (yes/no), quest ids |
| **Room description** | painted area | text read out when the party first enters ("boxed text") |
| **Rest spot** | point (campfire) | short rest allowed, long rest allowed |
| **Exit** | painted area | target adventure map and start point |

## 2. Trigger actions

A trigger runs a list of actions in order:

- `say "text"`: show a narration box.
- `check skill DC`: someone rolls; branches `pass` and `fail` each run their own action list.
- `fight zoneId`: start the encounter in that zone.
- `give item` / `take item` / `gold n`.
- `damage dice type` (with an optional save).
- `door id open|close|lock|unlock`, `reveal id` (hidden door, trap, person).
- `light id on|off`: turn a torch or brazier on or off.
- `flag name value`, and `if flag ... then ... else ...` for simple story state.
- `goto exitId`: leave to another map.
- `end "text"`: adventure complete.

## 3. Dialogue

A small tree per person: lines, and choices that can require a check ("[Persuasion DC 12] Let us pass") or a flag, and run actions (give a quest, open a shop, start a fight).

```json
{ "id": "innkeeper", "start": "hello",
  "nodes": {
    "hello": { "text": "Goblins took my cellar key. Get it back?",
               "choices": [ { "text": "We'll do it.", "do": [["flag", "quest_key", 1]], "next": "thanks" },
                            { "text": "[Persuasion DC 12] What's it worth?", "check": ["persuasion", 12],
                              "pass": "reward", "fail": "grumble" } ] } } }
```

## 4. File format

One JSON file per adventure, next to the map file it uses:

```json
{
  "version": 1,
  "name": "The Cellar Key",
  "maps": { "village": "maps/village.json", "cave": "maps/goblin-cave.json" },
  "start": { "map": "village", "at": "partyStart" },
  "party": ["fighter", "wizard"],
  "things": { "cave": [ { "id": "zone1", "kind": "encounter", "area": "…", "monsters": ["goblin", "goblin"] } ] },
  "dialogue": [ ... ],
  "items": [ ... ]
}
```

Map files stay the editor's own format; adventure data never goes into them, so the editor keeps working unchanged. Areas are stored like the editor stores painted layers (a mask, base64) or as rectangles.

## 5. Making adventures

- **First:** write the first adventure's JSON by hand, against a map made in the editor.
- **Now (Step 6a):** `adventure-editor.html`, a page of its own (the map editor is unchanged): add maps (a map editor `.json` or the generator), place spots, monsters, townsfolk, doors, chests, traps, exits, and room descriptions, set them up, try them in `adventure.html`, export the `.js` file. Dialogue and triggers are Step 6b.
- Random dungeons from the editor's generator could get encounters and loot placed automatically by room kind (it already places monsters by room kind, Phase 31).

## 6. First adventure: "The Cellar Key" (draft)

1. **Village tavern.** The innkeeper asks the party to get the cellar key back from goblins in the cave by the river. Rest and buy potions.
2. **The path.** A short walk; a goblin lookout on the watchtower can spot the party (Stealth vs passive Perception).
3. **Goblin cave.** Entrance fight (2 goblins); a tripwire trap in the tunnel; a locked side room with a chest; slimes by the pool (avoidable); the goblin boss at the camp with the key.
4. **Return.** The innkeeper pays; level 2.

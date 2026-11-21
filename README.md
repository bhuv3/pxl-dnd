# pxl-dnd

A turn-based fantasy game that plays like Dungeons & Dragons, built on the [pxl-map](https://github.com/bhuv3/pxl-map) pixel map editor. A party of heroes explores maps, rolls dice, talks to people, and fights monsters on a square grid. The editor draws the maps, lights, characters and monsters, and the game adds the rules, combat, spell effects and adventures.

This repo is a fork of pxl-map. `map-editor/` is the editor, unchanged, and the game in `dnd-game/` loads its modules from `../map-editor/js/`.

It's plain HTML, CSS and JavaScript, with no dependencies and no build step.

## Running

```bash
python3 serve.py
```

Then open one of the pages:

| Page | URL |
|---|---|
| Adventure: The Cellar Key | http://localhost:8765/dnd-game/adventure.html |
| Adventure editor | http://localhost:8765/dnd-game/adventure-editor.html |
| One fight | http://localhost:8765/dnd-game/fight.html |
| Practice room (every attack and spell) | http://localhost:8765/dnd-game/practice.html |
| Map editor | http://localhost:8765/map-editor/ |

## Layout

```
dnd-game/          The game: 4 pages, css/, js/ (rules, combat, effects, adventure, editor), adventures/
docs/dnd-game/     overview.md (start here), roadmap, rules, classes, monsters, combat, effects, adventures
dev/dnd-game/      Developer pages: fx-lab.html (effects lab), gltest.html, gltest-screen.html (GL parity)
tests/dnd-game/    rules-test.js (Node)
tools/dnd-game/    fx-sheet.js (contact sheet of a spell effect)
map-editor/ ...    The editor and its docs, dev pages, tests and tools, from pxl-map
```

## Tests

```bash
node tests/dnd-game/rules-test.js
```

For GL parity, open http://localhost:8765/dev/dnd-game/gltest.html while serving.

## Updating the editor

The editor comes from pxl-map. To pull in its changes:

```bash
git pull upstream main
```

## Credits and license

This work includes material from the System Reference Document 5.2 ("SRD 5.2") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.

The code is under the [MIT license](LICENSE). The SRD 5.2 material stays under CC BY 4.0.

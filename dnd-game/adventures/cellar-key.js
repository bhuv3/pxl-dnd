// "The Cellar Key", the first adventure (docs/adventures.md section 6), as data: the village and the goblin cave,
// who is where, doors, the lock, the chest, the trap, room descriptions, the innkeeper's dialogue, and the quest.
// Squares are [column, row] on the 10-pixel grid; a place-relative spot is { place, offset: [dx, dy] }.
Adventures.add({
  id: 'cellar-key',
  name: 'The Cellar Key',
  start: { map: 'village', at: 'start' },
  party: [
    { name: 'Fighter', key: 'hero-fighter', sheet: 'fighter' },
    { name: 'Cleric', key: 'hero-cleric', sheet: 'cleric' },
    { name: 'Wizard', key: 'hero-wizard', sheet: 'wizard' },
  ],

  maps: {
    village: {
      name: 'Millbrook',
      // Made by the map editor's village generator, flattened (the game doesn't draw hills yet).
      generate: { biome: 'village', width: 220, height: 160, seed: 4, settings: { timeOfDay: 15, dayCycle: false } },
      spots: {
        start: { place: 'tavern', offset: [1, 3] },
        fromCave: { exit: 'eastRoad', inward: 2 },
      },
      npcs: [{ name: 'Innkeeper', key: 'villager', role: 'baker', at: { place: 'tavern', offset: [-1, 2] }, talk: 'innkeeper' }],
      exits: [{ id: 'eastRoad', road: 'east', to: 'cave', at: 'entrance', needs: 'quest', refused: 'You have no reason to leave Millbrook yet. Talk to the innkeeper.' }],
      areas: [
        { place: 'tavern', radius: 4, text: 'Millbrook. Smoke curls from the chimney of the Bent Spoon tavern, and the innkeeper is pacing outside, wringing her apron.' },
      ],
      monsters: [], doors: [], chests: [], traps: [],
    },

    cave: {
      name: 'The goblin cave',
      build: {
        cols: 25, rows: 14, seed: 777, wall: 'STONE_WALL',
        floors: [
          [[0, 6, 5, 8], 'CAVE_FLOOR'],    // entrance tunnel (the left edge leads out)
          [[6, 3, 11, 10], 'FLAGSTONE'],   // guard room
          [[12, 6, 17, 7], 'CAVE_FLOOR'],  // passage
          [[13, 2, 16, 4], 'FLAGSTONE'],   // storeroom
          [[19, 4, 23, 11], 'FLAGSTONE'],  // boss's camp
          [[14, 5, 14, 5], 'FLAGSTONE'],   // door gaps
          [[18, 7, 18, 7], 'FLAGSTONE'],
        ],
        objects: [
          ['sconce', 75, 29], ['sconce', 105, 29], ['sconce', 145, 19], ['brazier', 215, 87],
          ['crate', 65, 37], ['barrel', 115, 97], ['sacks', 135, 27], ['crate', 165, 47], ['bedroll', 225, 57],
        ],
        settings: { underground: true, ambient: 0.28, wind: false },
      },
      spots: {
        entrance: { sq: [2, 7] },
      },
      sight: 7,
      monsters: [
        { name: 'Goblin 1', key: 'goblin', sheet: 'goblin', seed: 'torch', sq: [9, 5], group: 'guards' },
        { name: 'Goblin 2', key: 'goblin', sheet: 'goblin', seed: 6, sq: [10, 9], group: 'guards', role: 'archer' },
        { name: 'Goblin Boss', key: 'goblin', sheet: 'goblinBoss', seed: 33, sq: [22, 7], group: 'camp' },
        { name: 'Goblin 3', key: 'goblin', sheet: 'goblin', seed: 21, sq: [21, 10], group: 'camp', role: 'archer' },
      ],
      // What happens when a group is beaten.
      defeated: { camp: [['say', 'Round the boss\'s neck, on a greasy string: the cellar key. You take it.'], ['flag', 'key']] },
      doors: [
        { sq: [14, 5], locked: { skill: 'athletics', dc: 12, text: 'The storeroom door is locked.' } },
        { sq: [18, 7] },
      ],
      chests: [{ sq: [15, 3], gold: 18, potions: 2 }],
      traps: [{ sq: [15, 7], find: 14, save: { ability: 'dex', dc: 12 }, damage: '1d10', type: 'piercing', name: 'tripwire' }],
      exits: [{ id: 'mouth', rect: [0, 6, 0, 8], to: 'village', at: 'fromCave' }],
      areas: [
        { rect: [0, 6, 5, 8], text: 'A narrow tunnel slopes down into the dark. Ahead, goblins are laughing and someone is banging a pot.' },
        { rect: [6, 3, 11, 10], text: 'The guard room. Gnawed bones, a cold fire pit, and two goblins who were not expecting visitors.' },
        { rect: [12, 6, 17, 7], text: 'A low passage, damp underfoot. A door to the north, another at the far end.' },
        { rect: [13, 2, 16, 4], text: 'Sacks of stolen grain, a broken crate, and an iron-bound chest.' },
        { rect: [19, 4, 23, 11], text: 'Around a smoky brazier sits a big goblin in a dented helmet, a key on a string round his neck. He grins.' },
      ],
    },
  },

  // Who says what. start: the first node whose flags are all set. A choice can need a check ([skill, DC]: the
  // party member best at it rolls) and leads to next, or to pass / fail. do: actions, in order.
  // Actions: ['flag', name], ['gold', amount], ['say', text], ['levelUp', text] (everyone to the next level, fully
  // rested), ['end'] (the adventure is over once the talk ends).
  dialogue: {
    innkeeper: {
      name: 'Marta, the innkeeper',
      start: [{ if: ['returned'], node: 'after' }, { if: ['key', 'raised'], node: 'keyRaised' }, { if: ['key'], node: 'key' },
        { if: ['quest'], node: 'waiting' }, { node: 'hello' }],
      nodes: {
        hello: {
          text: 'Adventurers? Thank the gods. Goblins broke into my cellar last night and ran off with the key to it. My ale\'s locked in there! They hole up in a cave at the end of the east road. Bring that key back and there\'s 50 gold in it.',
          choices: [
            { text: 'We\'ll get your key.', do: [['flag', 'quest']], next: 'deal' },
            { text: '50 gold for a cave full of goblins? Make it 80.', check: ['persuasion', 12], pass: 'raise', fail: 'grumble' },
            { text: 'Not today.', next: null },
          ],
        },
        deal: { text: 'Bless you. Mind yourselves in that tunnel. The miller swears they\'ve strung traps across it.', choices: [{ text: 'We\'ll be careful.', next: null }] },
        raise: { text: 'Eighty! You\'d rob a widow in daylight. ...Fine. Eighty. But I want that key back tonight.', do: [['flag', 'quest'], ['flag', 'raised']], choices: [{ text: 'Deal.', next: null }] },
        grumble: { text: 'Fifty is what I\'ve got, and fifty is what you\'ll get. Take it or leave it.', choices: [{ text: 'We\'ll take it.', do: [['flag', 'quest']], next: 'deal' }, { text: 'Leave it, then.', next: null }] },
        waiting: { text: 'Any luck? The cave\'s at the end of the east road. Follow it out of the village.', choices: [{ text: 'We\'re on it.', next: null }] },
        key: { text: 'Is that... my key! You did it! Here: fifty gold, as promised, and you\'ll not pay for a drink in this house again.', do: [['gold', 50], ['flag', 'returned'], ['levelUp', 'A long rest at the Bent Spoon, and everyone levels up!'], ['end']], choices: [{ text: 'Glad to help.', next: null }] },
        keyRaised: { text: 'My key! Eighty gold, I said, and eighty it is. Worth every coin. Sit, sit, the first round\'s on me.', do: [['gold', 80], ['flag', 'returned'], ['levelUp', 'A long rest at the Bent Spoon, and everyone levels up!'], ['end']], choices: [{ text: 'Glad to help.', next: null }] },
        after: { text: 'Heroes of Millbrook! What\'ll it be?', choices: [{ text: 'Just passing through.', next: null }] },
      },
    },
  },

  // The quest line in the party panel: the first whose flag is set (no flag: always).
  quest: [
    { if: 'returned', text: 'Done!' },
    { if: 'key', text: 'Take the key back to the innkeeper.' },
    { if: 'quest', text: 'Find the cellar key in the goblin cave (east road).' },
    { text: 'Talk to the innkeeper.' },
  ],

  end: { title: 'The Cellar Key: complete', text: 'Millbrook has its ale back, and the party is level 2.' },
});

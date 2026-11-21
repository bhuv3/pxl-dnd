# Classes, species, and spells

Back to [overview.md](overview.md). Rules these use: [rules.md](rules.md). How each one looks: [effects.md](effects.md) section 5.

Based on the 2024 rules through the SRD 5.2 (Step 7d; its subclasses: Champion, Evoker, Life Domain, Thief, Oath of Devotion, all from level 3). Levels 1–5 only. Heroes are pre-made at first (no character creation). Checked against the SRD 5.2 text; the 2014 rules (SRD 5.1) are no longer used.

---

## 1. Pre-made heroes (level 1)

| Hero | Species | Background (feat) | Str | Dex | Con | Int | Wis | Cha | HP | AC | Speed | Main attack |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Fighter** | Human | Soldier (Savage Attacker) | 17 | 13 | 15 | 8 | 12 | 10 | 12 | 19 (chain mail, shield, Defense) | 30 | Longsword +5, 1d8+3 slashing (Sap) |
| **Wizard** (the elf wizard sprite) | Elf (high elf) | Sage (Magic Initiate, wizard) | 8 | 14 | 14 | 17 | 12 | 10 | 8 | 12 | 30 | Fire Bolt +5, 1d10 fire; spell DC 13 |
| **Cleric** | Dwarf | Acolyte (Magic Initiate, cleric) | 13 | 10 | 14 | 8 | 17 | 13 | 11 | 18 (chain mail, shield: Protector) | 30 | Mace +3, 1d6+1; Sacred Flame DC 13 |
| **Rogue** | Halfling | Criminal (Alert) | 8 | 17 | 15 | 12 | 13 | 10 | 10 | 14 (leather) | 30 | Shortsword +5, 1d6+3 (Vex); Sneak Attack +1d6 |
| **Paladin** | Dragonborn (red) | Soldier (Savage Attacker) | 17 | 10 | 14 | 8 | 12 | 14 | 12 | 18 (chain mail, shield) | 30 | Longsword +5, 1d8+3 (Sap); spell DC 12; fire breath DC 12 |

Scores are the standard array (15, 14, 13, 12, 10, 8) placed per class, then the background's increase: +2 to one of its three abilities and +1 to another. Species give no ability increases in the 2024 rules. The first playable party is Fighter + Wizard ([roadmap.md](roadmap.md)); "The Cellar Key" uses Fighter, Cleric, Wizard.

The numbers live in `js/rules/creatures.js` (`Creatures.HEROES`); keep the two in step.

How each one looks (drawn in code, `js/art/heroes.js`, outfits in `Heroes.OUTFITS`): Fighter in a helmet, chain mail and red tabard with a sword and red shield; Wizard in a pointed blue hat and robe with a glowing orb staff; Cleric, a bearded dwarf in a steel cap, chain and white tabard with a gold sun, mace and shield; Rogue, a halfling in a green hood with a dagger; Paladin, a red dragonborn in plate with a blue cape and sword.

## 2. Species and feats

| Species | Traits used in the game |
|---|---|
| Human | **Resourceful** (Heroic Inspiration after a long rest: not built yet), **Skillful** (one more skill: Insight), **Versatile** (an Origin feat: Alert) |
| Elf (high elf) | Darkvision 60 ft; **Fey Ancestry** (advantage on saves against being charmed); **Trance** (magic can't put it to sleep); Keen Senses (Perception); High Elf lineage: Prestidigitation (not built) |
| Dwarf | Darkvision 120 ft; **Dwarven Resilience** (resistance to poison, advantage on saves against being poisoned); **Dwarven Toughness** (+1 HP per level); Stonecunning (not built) |
| Halfling | **Luck** (reroll a natural 1 on a d20 test); Brave; Halfling Nimbleness; Naturally Stealthy (not built) |
| Dragonborn (red) | Resistance to fire; darkvision 60 ft; **Breath Weapon** in place of an attack: a 15 ft cone or a 30 ft line, Dex save (DC 8 + Con + proficiency), 1d10 fire (2d10 at level 5), half on a save, proficiency bonus times per long rest |

| Feat | What it does here |
|---|---|
| **Savage Attacker** | Once a turn, on a weapon hit, roll the weapon's damage dice twice and keep the higher |
| **Alert** | Add the proficiency bonus to initiative (the swap with an ally isn't built) |
| **Magic Initiate** | Two cantrips and one level 1 spell always prepared (the wizard's Sleep, the cleric's Shield of Faith); the free cast once a long rest isn't built |
| **Defense** (Fighting Style) | +1 AC in armor |

## 3. Classes, levels 1–5

### Fighter (Champion at 3) — hit die d10, saves Str and Con

| Level | Features |
|---|---|
| 1 | Fighting Style (Defense); **Second Wind** (bonus action, heal 1d10 + level, two uses: one back on a short rest, all on a long rest); **Weapon Mastery** (3 kinds: the longsword's Sap is used) |
| 2 | **Action Surge** (one extra action, not a Magic action, once per short rest); Tactical Mind |
| 3 | Champion: **Improved Critical**, crits on 19–20; Remarkable Athlete |
| 4 | Ability Score Improvement; Second Wind three uses |
| 5 | **Extra Attack**; Tactical Shift |

### Wizard (Evoker at 3) — hit die d6, saves Int and Wis, casts with Int

| Level | Features | Cantrips | Prepared | Slots (1st/2nd/3rd) |
|---|---|---|---|---|
| 1 | Spellcasting; Ritual Adept; **Arcane Recovery** | 3 | 4 | 2 / – / – |
| 2 | Scholar (Expertise in Arcana) | 3 | 5 | 3 / – / – |
| 3 | Evoker: Evocation Savant, **Potent Cantrip** (half damage on a miss or a save) | 3 | 6 | 4 / 2 / – |
| 4 | Ability Score Improvement | 4 | 7 | 4 / 3 / – |
| 5 | Memorize Spell; 3rd-level spells | 4 | 9 | 4 / 3 / 2 |

- Cantrips: Fire Bolt, Ray of Frost, Shocking Grasp; Magic Initiate adds two (Light, Mage Hand: not built); the high elf adds Prestidigitation.
- Prepared: Magic Missile, Burning Hands, Thunderwave, Shield; Magic Initiate adds Sleep.
- Sculpt Spells (friends in your areas are safe) is an Evoker feature at **level 6** now, so the wizard's areas hit friends at levels 1–5.

### Cleric (Life Domain at 3) — hit die d8, saves Wis and Cha, casts with Wis

| Level | Features | Cantrips | Prepared | Slots |
|---|---|---|---|---|
| 1 | Spellcasting; **Divine Order: Protector** (martial weapons, heavy armor) | 3 | 4 | 2 / – / – |
| 2 | **Channel Divinity** twice (one back on a short rest): **Divine Spark** (30 ft: heal 1d8 + Wis, or a Con save against 1d8 + Wis necrotic or radiant, half on a save) and **Turn Undead** (undead within 30 ft: Wis save or frightened and incapacitated for 1 minute) | 3 | 5 | 3 / – / – |
| 3 | Life Domain: **Disciple of Life** (healing spells heal 2 + the slot level more), **Preserve Life** (5 × level HP shared among bloodied creatures within 30 ft); domain spells | 3 | 6 | 4 / 2 / – |
| 4 | Ability Score Improvement | 4 | 7 | 4 / 3 / – |
| 5 | **Sear Undead** (turned undead take Wis-mod d8 radiant) | 4 | 9 | 4 / 3 / 2 |

- Cantrips: Sacred Flame, Guidance, Light (only Sacred Flame is built); Magic Initiate adds two more (not built).
- Prepared: Bless, Cure Wounds, Guiding Bolt, Healing Word; Magic Initiate adds Shield of Faith.

### Rogue (Thief at 3) — hit die d8, saves Dex and Int

| Level | Features |
|---|---|
| 1 | **Expertise** (Stealth, Perception); **Sneak Attack** 1d6 once a turn (advantage, or an ally next to the target; finesse or ranged weapon); Thieves' Cant; **Weapon Mastery** (shortsword Vex, dagger Nick) |
| 2 | **Cunning Action**: Dash, Disengage, or Hide as a bonus action |
| 3 | Sneak Attack 2d6; Steady Aim; Thief: Fast Hands, Second-Story Work |
| 4 | Ability Score Improvement |
| 5 | Sneak Attack 3d6; **Cunning Strike**; **Uncanny Dodge** (reaction: halve an attack's damage) |

### Paladin (Oath of Devotion at 3) — hit die d10, saves Wis and Cha, casts with Cha

| Level | Features | Prepared | Slots |
|---|---|---|---|
| 1 | **Lay On Hands** (a pool of 5 × level HP, bonus action, refills on a long rest); Spellcasting; **Weapon Mastery** (2 kinds: the longsword's Sap is used) | 2 | 2 / – |
| 2 | Fighting Style; **Paladin's Smite** (Divine Smite always prepared, once a long rest without a slot) | 3 | 2 / – |
| 3 | Channel Divinity; Devotion: **Sacred Weapon** | 4 | 3 / – |
| 4 | Ability Score Improvement | 5 | 3 / – |
| 5 | **Extra Attack**; Faithful Steed | 6 | 4 / 2 |

- Prepared at level 1: Divine Smite and Bless.

### Built so far (Step 10a: level 2)

Levels live in `Creatures.LEVELS` (one row per class per level: slots, uses, actions, traits, Expertise), applied by `Creatures.levelUp`. `fight.html` and the practice room have a level picker.

| Hero | Level 2 as built |
|---|---|
| Fighter | **Action Surge** (a free button, ✦, after the action is used: the action comes back; once per short rest; the AI swings again with it). **Tactical Mind**: a failed check outside fights adds 1d10, spending a Second Wind only if that makes it succeed. 20 HP. |
| Wizard | A third 1st-level slot; Chromatic Orb prepared (the fifth); Scholar (Arcana +7). **Arcane Recovery** (a level 1 feature, built now): on a short rest, spent slots worth half the level, rounded up, once per long rest. |
| Cleric | A third 1st-level slot; Inflict Wounds prepared. **Channel Divinity** twice (one back on a short rest): **Divine Spark** (two buttons: a CON save against 1d8 + Wis, radiant or necrotic picked, half on a save; or heal another creature 1d8 + Wis) and **Turn Undead** (undead within 30 ft that it can see: WIS save or turned, fleeing on their turns until hurt or the fight ends). |
| Rogue | **Cunning Action**: Dash ◆ and Disengage ◆ buttons, and **Hide** (◆): only where no enemy can see you (walls, pillars, crates block sight); a DC 15 Stealth check (+7); hidden, you attack with advantage and are attacked with disadvantage, until you attack or an enemy who can see you has a passive Perception of at least your check. |
| Paladin | **Fighting Style: Blessed Warrior** (Sacred Flame with Charisma, DC 12; Guidance not built). **Paladin's Smite**: the first Divine Smite after a long rest needs no slot (and doesn't count as the turn's slot spell). Cure Wounds and Shield of Faith prepared. |

### Built so far (Step 10b: level 3, the subclasses)

| Hero | Level 3 as built |
|---|---|
| Fighter (Champion) | **Improved Critical**: weapon attacks crit on 19–20 (spells don't). **Remarkable Athlete**: advantage on initiative and Athletics checks; after a crit on its turn, half its speed of movement that provokes no opportunity attacks (shown as "+15 free" on the move pip). 28 HP. |
| Wizard (Evoker) | Slots 4 / 2; Scorching Ray prepared. **Potent Cantrip**: a damaging cantrip that misses (or is saved against) does half its damage and nothing else (no slow, no shock); POTENT over the number. |
| Cleric (Life Domain) | Slots 4 / 2. **Disciple of Life**: healing spells with a slot heal 2 + the slot level more. **Preserve Life** (Channel Divinity): 15 HP shared among bloodied friends within 30 ft, the cleric too, the most hurt first, none past half its HP maximum; the AI uses it when two or more are bloodied. Domain spells: **Aid** (Bless's way of picking up to three: +5 HP maximum and HP for the fight), **Lesser Restoration** (a bonus action touch: ends paralysis), Bless, Cure Wounds. **Spiritual Weapon** (bonus action, concentration): a gold hammer appears next to the target and attacks (melee spell attack, 1d8 + 3 force); "Spiritual Weapon strike" (◆) on later turns flies it to someone within 25 ft and attacks again. 27 HP. |
| Rogue (Thief) | **Sneak Attack 2d6**. **Steady Aim** (◆, only before moving): advantage on the next attack this turn, then speed 0. Fast Hands and Second-Story Work aren't in fights. |
| Paladin (Devotion) | A third 1st-level slot. **Channel Divinity** twice: **Sacred Weapon** (free: + Cha, +2, to longsword attacks for the fight; the paladin glows). Divine Sense isn't built. Oath spells: **Protection from Evil and Good** (touch, concentration: fey, undead, fiends, aberrations, celestials, elementals attack the warded one at disadvantage; goblins are fey) and Shield of Faith. 28 HP. |

### Built so far (Step 10c: level 4)

Everyone takes the **Ability Score Improvement** feat (+2 to the main ability; the SRD 5.2's only other general feat is Grappler). `Creatures.improve` raises the score and everything worked out from it: weapon attacks and damage using it (a weapon's `ability`, Strength by default), the spell attack and DC, AC in light armor or none (`acDex`).

| Hero | Level 4 as built |
|---|---|
| Fighter | Str 19: longsword +6, 1d8+4. Second Wind three times. 36 HP. |
| Wizard | Int 19: spell attack +6, DC 14. Slots 4 / 3. Acid Splash (a fourth cantrip) and Misty Step prepared. 26 HP. |
| Cleric | Wis 19: spell attack +6, DC 14, healing +4. Slots 4 / 3. **Spare the Dying** (a fourth cantrip: 15 ft, a friend at 0 HP becomes stable; the AI uses it when it has no healing left) and Hold Person prepared. 35 HP. |
| Rogue | Dex 19: shortsword +6, 1d6+4; dagger +6, 1d4+4; AC 15; Stealth +8. 31 HP. |
| Paladin | Str 19: longsword +6, 1d8+4. 36 HP. (Its fifth prepared spell: nothing else built to choose.) |

### Built so far (Step 10d: level 5)

Proficiency +3 for everyone: `levelUp` adds the change to weapon attacks, the spell attack and DC, and the breath DC (saves and skills follow the level already). Cantrips and the breath grow through each action's `upgrade` (`Actions.at`).

| Hero | Level 5 as built |
|---|---|
| Fighter | **Extra Attack**: the Attack action is two attacks (⚔ on the budget shows the second; Action Surge makes it four). **Tactical Shift**: Second Wind also gives half its speed of movement with no opportunity attacks. Longsword +7. 44 HP. |
| Wizard | Slots 4 / 3 / 2; **Fireball** and **Haste** prepared. Spell attack +7, DC 15. Fire Bolt 2d10, Ray of Frost and Shocking Grasp 2d8, Acid Splash 2d6, True Strike +1d6 radiant. Memorize Spell isn't built. 32 HP. |
| Cleric | Slots 4 / 3 / 2; DC 15. **Sear Undead** (Turn Undead: undead that fail also take 4d8 radiant and stay turned). **Spirit Guardians** (concentration: gold spirits circle the cleric 15 ft out; an enemy that steps in, is reached as the cleric moves, or ends its turn there makes a WIS save, 3d8 radiant, half on a save, once a turn; an enemy starting its turn there has half its movement). **Mass Healing Word** (◆: the six most hurt friends within 60 ft, 2d4 + 4 + 5 each). **Revivify** (touch a friend who died this fight: back with 1 HP). Sacred Flame 2d8; Spare the Dying 30 ft. 43 HP. |
| Rogue | **Sneak Attack 3d6**. **Cunning Strike** (a row under Sneak Attack: Poison, Trip, or Withdraw for one of the d6s; DC 15). **Uncanny Dodge** (the reaction, used by itself when a hit lands: half damage, DODGE). 38 HP. |
| Paladin | **Extra Attack** (the breath counts as one attack: breathe, then swing). Slots 4 / 2; Aid prepared; DC 13; the breath 2d10, three times. Faithful Steed isn't built. 44 HP. |

## 4. Spells used in the game

Only spells listed here are built. Each has an effect in [effects.md](effects.md) section 5. Numbers from the SRD 5.2.

| Spell | Level | Cast | Range / area | What it does |
|---|---|---|---|---|
| Fire Bolt | cantrip | action | 120 ft | Spell attack, 1d10 fire (2d10 at level 5) |
| Ray of Frost | cantrip | action | 60 ft | Spell attack, 1d8 cold, speed −10 ft until the start of your next turn |
| Sacred Flame | cantrip | action | 60 ft | Dex save or 1d8 radiant (2d8 at level 5); ignores cover |
| Acid Splash | cantrip | action | 60 ft, 5 ft radius | Dex save, 1d6 acid, each creature in it |
| Poison Spray | cantrip | action | 30 ft | Spell attack, 1d12 poison |
| Shocking Grasp | cantrip | action | touch | Melee spell attack, 1d8 lightning; no opportunity attacks until its next turn |
| Chill Touch | cantrip | action | touch | Melee spell attack, 1d10 necrotic; no healing until the end of your next turn |
| True Strike | cantrip | action | self (weapon) | One attack with your weapon, using your spellcasting ability; radiant or the weapon's type (+1d6 radiant at level 5) |
| Magic Missile | 1 | action | 120 ft | Three darts, 1d4+1 force each, always hit; +1 dart per slot level above 1st |
| Burning Hands | 1 | action | 15 ft cone | Dex save, 3d6 fire, half on a save |
| Thunderwave | 1 | action | 15 ft cube | Con save, 2d8 thunder and pushed 10 ft; half and no push on a save (here: the 8 squares round the caster, the user's call) |
| Shield | 1 | reaction | self | +5 AC until the start of your next turn, including against the triggering attack |
| Sleep | 1 | action, concentration | 60 ft, 5 ft radius | Creatures you choose: Wis save or incapacitated until the end of their next turn, then a second save or unconscious; ends on damage or a shake; elves and undead unaffected |
| Chromatic Orb | 1 | action | 90 ft | Spell attack, 3d8 of a type you pick; two matching dice: it leaps to another creature within 30 ft |
| Cure Wounds | 1 | action | touch | Heal 2d8 + casting mod |
| Healing Word | 1 | bonus action | 60 ft | Heal 2d4 + casting mod |
| Guiding Bolt | 1 | action | 120 ft | Spell attack, 4d6 radiant; the next attack on the target before the end of your next turn has advantage |
| Bless | 1 | action, concentration | 30 ft, 3 creatures | +1d4 to attack rolls and saves for 1 minute |
| Shield of Faith | 1 | bonus action, concentration | 60 ft | +2 AC for 10 minutes |
| Inflict Wounds | 1 | action | touch | Con save, 2d10 necrotic, half on a save |
| Spare the Dying | cantrip | action | 15 ft (30 ft at level 5) | A creature at 0 HP that isn't dead becomes stable |
| Divine Smite | 1 | bonus action, after a melee hit | self | +2d8 radiant, +1d8 against undead or fiends |
| Scorching Ray | 2 | action | 120 ft | Three rays, each a spell attack for 2d6 fire |
| Shatter | 2 | action | 60 ft, 10 ft radius | Con save, 3d8 thunder, half on a save |
| Blur | 2 | action, concentration | self | Attacks against you have disadvantage |
| Misty Step | 2 | bonus action | 30 ft | Teleport to a free square you can see |
| Spiritual Weapon | 2 | bonus action, concentration (2024) | 60 ft | A spectral weapon by the target: melee spell attack, 1d8 + mod force; a bonus action later moves it 20 ft and attacks again |
| Aid | 2 | action | 30 ft, up to 3 | +5 HP maximum and HP (8 hours: here, the fight) |
| Lesser Restoration | 2 | bonus action | touch | Ends Blinded, Deafened, Paralyzed, or Poisoned (here: paralyzed) |
| Protection from Evil and Good | 1 | action, concentration | touch | Aberrations, celestials, elementals, fey, fiends, undead have disadvantage on attacks against the target |
| Fireball | 3 | action | 150 ft, 20 ft radius | Dex save, 8d6 fire, half on a save |
| Lightning Bolt | 3 | action | 100 ft line, 5 ft wide | Dex save, 8d6 lightning, half on a save |
| Spirit Guardians | 3 | action, concentration | 15 ft round you | Enemies entering or ending a turn there: WIS save, 3d8 radiant, half on a save, once a turn; half speed there |
| Mass Healing Word | 3 | bonus action | 60 ft, up to 6 | Heal 2d4 + casting mod each |
| Revivify | 3 | action | touch | A creature that died within the last minute (here: this fight) comes back with 1 HP |

**One spell with a slot a turn** (2024): a turn's spells can use at most one spell slot between them (Divine Smite counts).

**Concentration:** one concentration spell at a time. Taking damage: Con save, DC 10 or half the damage (whichever is higher, up to 30), or the spell ends. Being incapacitated ends it too.

**Weapon mastery used:** Sap (longsword: the target's next attack roll has disadvantage until the start of your next turn), Vex (shortsword: your next attack against it has advantage until the end of your next turn). Nick (dagger) needs two-weapon fighting, not built.

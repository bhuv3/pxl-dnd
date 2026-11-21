# Rules

Back to [overview.md](overview.md).

The dice rules, based on the 2024 rules as the System Reference Document 5.2 (SRD 5.2) gives them, with a few simplifications for a computer game. Step 7d switched everything from the 2014 rules (SRD 5.1) to these, at the user's request. Classes are in [classes.md](classes.md), monsters in [monsters.md](monsters.md), how a fight runs on screen in [combat.md](combat.md).

**Status:** partly built (Step 3, `js/rules/`). "How close to 5e" is still an open decision ([overview.md](overview.md) section 3). Simplifications are marked **[S]**.

**Built so far** (`Dice`, `Creatures`, `Actions`, `Rules`; tests: `node tests/dnd-game/rules-test.js`): dice notation and seeded rolls (section 1), advantage and disadvantage, ability modifiers and proficiency (2), saving throws (3), attack rolls with natural 20 / natural 1, crits doubling dice, damage types with resistance, vulnerability, and immunity (4), healing, and the halfling's Luck. Step 5b added: level 2 (`Creatures.levelUp`, at a story milestone). Step 5a added: ability checks and skills, passive Perception, short rests (hit dice), potions. Step 4 added: initiative, turns, movement, opportunity attacks, Dash / Disengage / Dodge, range and long range, death saves and damage at 0 HP, massive damage, spell slots, limited uses (Second Wind). Step 7 added (`Conditions`, js/rules/conditions.js): conditions with a duration (asleep, slowed, guided, blessed, Shield of Faith), concentration (one spell at a time; damage means a CON save, DC 10 or half the damage; dropping to 0 HP ends it), Bless's +1d4 on attacks and saves, AC bonuses, forced movement (Thunderwave's push), areas on the grid (cone, cube, circle), shaking a sleeper awake. Step 7d added the 2024 rules (section 12): incapacitated, Sleep's two saves, one spell with a slot a turn, weapon mastery (Sap, Vex), the Origin feats Savage Attacker and Alert, Expertise, Trance. Step 7e added (section 13): paralyzed, charmed by a pattern, Haste and its lethargy, Mage Armor, Mirror Image's duplicates, a Flaming Sphere on the grid, saves at the end of turns, advantage on some saves. **Not yet:** cover, difficult terrain, the other conditions in section 7 (prone, frightened, restrained, poisoned, blinded), light and vision (8), long rests (9), levels past 2 (10).

**License:** the SRD 5.2 is released under Creative Commons Attribution 4.0. Using its rules and stat blocks needs this credit line, word for word, on every page with rules (`fight.html`, `practice.html`, `adventure.html`): "This work includes material from the System Reference Document 5.2 ("SRD 5.2") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode." The SRD asks for no other attribution to Wizards; the game may call itself "compatible with fifth edition" or "5E compatible". Don't use names or content outside the SRD (no Beholders, Mind Flayers, Forgotten Realms names, and so on). Every spell built or planned so far is in the SRD 5.2.

---

## 1. Dice

- Notation: `XdY+Z`, for example `1d20+5`, `2d6+3`, `8d6`.
- Dice use a seeded RNG (separate from drawing randomness), so a fight can be replayed from its seed.
- **Advantage:** roll 2d20, keep the higher. **Disadvantage:** keep the lower. Having both cancels out; several sources don't stack.

## 2. Abilities

Six scores: Strength, Dexterity, Constitution, Intelligence, Wisdom, Charisma.

- Modifier = `floor((score − 10) / 2)`. So 10–11 → +0, 14–15 → +2, 18–19 → +4.
- Heroes use the standard array **[S: no rolling]**: 15, 14, 13, 12, 10, 8, placed per class, plus racial bonuses.

**Proficiency bonus:** +2 at levels 1–4, +3 at level 5.

## 3. Checks and saves

- **Ability check:** `d20 + ability modifier (+ proficiency if proficient in the skill)` ≥ DC.
- **DCs:** very easy 5, easy 10, medium 15, hard 20, very hard 25.
- **Saving throw:** `d20 + ability modifier (+ proficiency if proficient in that save)` ≥ the effect's DC.
- **Spell save DC:** `8 + proficiency + spellcasting modifier`. **Spell attack:** `d20 + proficiency + spellcasting modifier`.
- Skills used in the game **[S: only these]**: Athletics (Str), Acrobatics, Sleight of Hand, Stealth (Dex), Arcana, Investigation, Religion (Int), Insight, Medicine, Perception (Wis), Deception, Intimidation, Persuasion (Cha).
- **Passive Perception** = 10 + Perception bonus. Used to notice traps and hidden doors without rolling.

## 4. Attacks and damage

- **Attack roll:** `d20 + ability modifier + proficiency (if proficient with the weapon)` ≥ target's AC → hit.
  - Melee weapons use Strength; finesse weapons may use Dexterity; ranged weapons use Dexterity.
- **Natural 20:** always hits, critical hit: roll all damage dice twice, add the modifier once.
- **Natural 1:** always misses.
- **Damage:** weapon or spell dice + ability modifier (spells add it only if they say so).
- **Resistance** halves damage (round down), **vulnerability** doubles it, **immunity** cancels it.
- **Damage types:** slashing, piercing, bludgeoning, fire, cold, lightning, force, radiant, necrotic, acid, poison, psychic, thunder. Each has its own effect colors ([effects.md](effects.md) section 9).
- **Cover:** half cover +2 AC, three-quarters +5. **[S]** Cover only from walls and big furniture, worked out from the grid.
- **Ranged attack with an enemy next to you:** disadvantage. Beyond normal range (up to long range): disadvantage.

## 5. Hit points and dying

- Max HP at level 1 = class hit die maximum + Con modifier. Each level after: fixed average (d6 → 4, d8 → 5, d10 → 6) + Con modifier **[S: no rolling]**.
- At 0 HP a hero falls **unconscious** and makes a **death saving throw** each turn: d20, 10+ is a success, 3 successes → stable, 3 failures → dead. Nat 20: wake with 1 HP. Nat 1: two failures. Taking damage at 0 HP is a failure (a crit, two).
- Any healing wakes them up.
- Monsters die at 0 HP **[S: no death saves for monsters]**.
- **Temporary HP** absorb damage first and don't stack (keep the higher).

## 6. Combat turns

- **Initiative:** `d20 + Dex modifier` for each creature at the start; highest goes first. **[S]** Monsters of the same kind share one roll.
- **Surprise:** creatures that didn't notice the enemy (failed Perception against Stealth) skip their first turn.
- **Round** = everyone takes one turn (6 seconds).
- **On your turn:**
  - **Move** up to your speed (30 ft = 6 squares for most). You can split moving around your action.
  - **One action:** Attack, Cast a Spell, Dash (double move), Disengage (no opportunity attacks this turn), Dodge (attacks against you have disadvantage), Help (an ally gets advantage), Hide (Stealth check), Use an Object.
  - **One bonus action**, only if something gives you one (Second Wind, Healing Word, Divine Smite, Cunning Action, Misty Step).
  - **One spell with a spell slot a turn** (2024): whatever you cast on your turn, only one of the spells can use a slot (Divine Smite counts). Cantrips are free.
  - **One reaction per round**, on anyone's turn: an opportunity attack, or Shield.
  - One free object interaction (open a door, draw a weapon).
- **Opportunity attack:** when an enemy leaves your reach without Disengaging, one melee attack as a reaction.
- **Grid:** 1 square = 5 ft. **[S]** Distances use Pythagoras between square centres (the user's call, instead of 5e's 5 ft diagonals): a diagonal step costs about 7 ft (√2 squares), so 30 ft is 6 squares straight or 4 diagonally, and ranges and areas are measured the same way. Reach is the 8 squares around you, diagonals included. Difficult terrain (rubble, mud, shallow water) costs double. Allies' squares can be passed through but not ended in; enemies' squares block.
- **Areas on the grid:** a square is in the area if the area covers its center. Cones start from an edge of the caster's square.

## 7. Conditions (only these, at first)

| Condition | Effect |
|---|---|
| Prone | Melee attacks against it have advantage, ranged have disadvantage; standing costs half your movement |
| Frightened | Disadvantage on checks and attacks while the source is in sight; can't move closer to it |
| Restrained | Speed 0; attacks against it have advantage; its attacks have disadvantage |
| Poisoned | Disadvantage on attacks and ability checks |
| Incapacitated | No actions, bonus actions, or reactions; its concentration ends; disadvantage on initiative |
| Unconscious | Incapacitated and prone; auto-fails STR and DEX saves; attacks against it have advantage; melee hits within 5 ft are crits |
| Blinded | Its attacks have disadvantage; attacks against it have advantage |
| Drowsy (Sleep, first failed save) | Incapacitated until the end of its next turn, then a second WIS save or asleep |
| Asleep (Sleep, second failed save) | Unconscious until the spell ends, it takes damage, or someone next to it shakes it awake (an action) |
| Paralyzed (Hold Person) | Incapacitated, speed 0; auto-fails STR and DEX saves; attacks against it have advantage; a hit from within 5 ft is a crit |
| Charmed by Hypnotic Pattern | Incapacitated, speed 0, until it takes damage or someone next to it shakes it out of it (an action) |

**Built (Step 7e):** paralyzed (Hold Person: helpless like a sleeper; a WIS save at the end of each of its turns ends it), charmed by the pattern (Hypnotic Pattern; Shake awake works on it too), hasted (Haste: +2 AC, speed doubled, advantage on DEX saves, one extra action), lethargic (when Haste ends: incapacitated, speed 0, until the end of its next turn; if it ends during the creature's own turn, that turn doesn't count), Mage Armor (base AC 13 + Dex), mirrored (Mirror Image: duplicates left, drawn round the caster). Elves save with advantage against being charmed (Fey Ancestry). The slime can't be charmed and has blindsight. A concentration spell that takes hold of no one (every target saved) ends at once, and one whose last target is freed (saved, woken, shaken) ends then.

**Built (Step 7d, the 2024 text):** drowsy and asleep (Sleep: both incapacitating, both end with the wizard's concentration; asleep counts as unconscious), shocked (Shocking Grasp: no opportunity attacks until its own next turn; Shield and other reactions still work), chilled (Chill Touch: can't regain HP until the end of the caster's next turn), vexed (Vex: the attacker's next attack against it has advantage, until the end of the attacker's next turn), sapped (Sap: its next attack roll has disadvantage, until the start of the attacker's next turn). True Strike is an attack now, so the old "foreseen" condition is gone.

**Built (Step 7c):** blurred (attacks against it have disadvantage, concentration). Durations like "until the end of your next turn" skip the end of the casting turn.

**Built (Step 7):** asleep (as unconscious: skips its turns, attacks against it have advantage, melee hits are crits, fails STR and DEX saves; wakes when hurt or when a friend uses Shake awake), slowed (−10 ft until the start of the caster's next turn), guided (the next attack roll against it has advantage, until the end of the caster's next turn), blessed (+1d4 to attack rolls and saves, concentration), Shield of Faith (+2 AC, concentration). Simplifications: every condition ends when the fight ends; Bless picks the caster and the nearest friends within 30 ft (up to 3) instead of letting you choose; an incapacitated creature also doesn't move on its turn (2024 incapacitated alone allows moving); concentration spells don't count down their minute (fights end sooner). Areas hit friends too (Sculpt Spells is a level 6 Evoker feature in 2024), except Sleep, which catches only the creatures the caster chooses. Thunderwave hits the 8 squares all round the caster (a 15 ft cube centred on them), not a cube to one side as in 5e: the user's call, keep it.

## 8. Light and vision

- **Bright light:** normal. **Dim light:** disadvantage on Perception that relies on sight. **Darkness:** effectively blinded.
- Light sources: torch 20 ft bright + 20 ft dim; the wizard's orb (game feature) 15 ft bright + 15 ft dim **[S: tune in the lab]**; light cantrip 20 + 20.
- **Darkvision 60 ft:** dim light counts as bright, darkness as dim (grey). Elves, dwarves, goblins, skeletons have it.
- The game uses the editor's light buffer to decide if a square is lit: bright, dim, or dark by the light amount on its center pixel.

## 9. Resting

- **Short rest (1 hour):** spend hit dice to heal (roll + Con each). Some features come back: one use of Second Wind, one of Channel Divinity, all of Action Surge (`Creatures.shortRest`). **[S]** Only at a campfire or a safe room.
- **Long rest (8 hours):** full HP, all spell slots back, all hit dice back (2024), the Dragonborn breath, Lay on Hands. Once per day; resting in a dungeon may draw a random encounter. Not built yet (the level-up milestone rests the party fully).

## 10. Levels

- Levels 1–5. XP from fights and quests; thresholds 300, 900, 2700, 6500 (levels 2–5). **[S, optional]** Level up at story milestones instead.
- Level 4: the Ability Score Improvement feat (+2 to one ability, or +1 to two). **[S: no other general feats]**
- Level 5 is the big jump: Extra Attack for Fighter and Paladin, 3rd-level spells for Wizard and Cleric (Fireball, Lightning Bolt, Spirit Guardians), proficiency +3, cantrips get stronger.

## 11. Simplifications summary

Standard array, fixed HP per level, shared monster initiative, cover only from walls and big furniture, short rests only in safe places, a short list of skills and conditions, only the Origin feats the pre-made heroes have, no multiclassing, no encumbrance, gold and items kept simple. Add rules back only when a fight feels flat without them.

## 12. The 2024 rules in the game (Step 7d)

What changed from the 2014 rules, and how it's built. Source: the SRD 5.2 text.

- **Character building:** the background gives +2/+1 (or +1/+1/+1) to three listed abilities and an Origin feat; species give traits only. The heroes' sheets are in [classes.md](classes.md).
- **Origin feats:** Savage Attacker (once a turn, weapon damage dice rolled twice, the higher kept: `opts.savage`, tracked per turn by `Combat`), Alert (proficiency added to initiative), Magic Initiate (two cantrips and a level 1 spell; **[S]** its free cast isn't built). Defense, a Fighting Style feat: +1 AC in armor.
- **Weapon mastery:** only for heroes, and only the properties of the weapons they use. Sap (longsword) and Vex (shortsword) are built as conditions on the target (section 7). Nick (dagger) needs two-weapon fighting: not built.
- **Expertise:** twice the proficiency bonus on the skill (rogue: Stealth, Perception; wizard at level 2: Arcana).
- **One spell with a spell slot a turn** (section 6).
- **Divine Smite** is a level 1 paladin spell, cast as a bonus action right after a melee hit. **[S]** It's one button: an attack with the longsword that, on a hit, spends a slot and the bonus action and adds 2d8 radiant (+1d8 against undead or fiends); a miss spends neither.
- **Dragonborn breath** replaces one attack of the Attack action: at levels 1–4 that's the whole action. A 15 ft cone or a 30 ft line (two buttons), 1d10, proficiency bonus uses per long rest.
- **Chromatic Orb:** if two or more of its d8s match, it leaps to the nearest other enemy within 30 ft of the target (a new attack and damage roll; once with a level 1 slot). **[S]** the game picks the second target.
- **Monsters' "+1d4 if the attack roll had advantage"** (goblins): `advDamage` on the weapon.
- **Cantrip damage** grows at levels 5, 11, 17 (Fire Bolt 2d10 at 5; True Strike +1d6 radiant): built with level 5 (Step 10d).
- **Not built yet:** Heroic Inspiration (the human gets one per long rest: reroll any die), the 2024 Exhaustion (−2 per level to d20 tests, −5 ft speed per level), the Help action's Assist, Bloodied as a trigger, Lay on Hands, Divine Spark, Tactical Mind.
- **House rules kept:** Pythagoras distances (section 6), Thunderwave all round the caster (section 7).

## 13. The medium spell batch (Step 7e)

The 2024 text of each, and what the game simplifies. They're in the practice room (the wizard; Hold Person for the cleric too); the adventure's heroes get them with spell choice as they level (Steps 10b–10d).

- **Mage Armor** (1st): touch, a creature wearing no armor (only the wizard, `unarmored` on the sheet): base AC 13 + Dex. **[S]** Its 8 hours last the fight; carrying it between fights waits for casting outside fights.
- **Hold Person** (2nd, concentration): a Humanoid within 60 ft, WIS save or paralyzed; a new save at the end of each of its turns. In the 2024 rules goblins are Fey (Small Fey, Goblinoid), so it works on cultists and people, not goblins, skeletons, or slimes; the button says why.
- **Mirror Image** (2nd, not concentration): three duplicates. An attack roll that hits the caster rolls a d6 per duplicate left; any 3 or higher, a duplicate is hit instead and vanishes (Scorching Ray checks each ray). A creature with blindsight isn't fooled. **[S]** The 1 minute lasts the fight.
- **Flaming Sphere** (2nd, concentration): a 5 ft ball of fire on a free square within 60 ft. Anyone (friends and the caster too) who ends a turn within 5 ft of it (its square or the 8 round it) makes a DEX save: 2d6 fire, half on a save. Roll the sphere (a bonus action): up to 30 ft in a straight line it can see along; the first creature in the way is rammed (it saves) and the sphere stops on the square before it. It lights up the room. **[S]** It doesn't block movement, can't jump pits or climb, and burning objects aren't built.
- **Hypnotic Pattern** (3rd, concentration): a 30 ft cube (6 × 6 squares; the aimed square is just off its middle) within 120 ft. Everyone inside who can see it, the caster's friends too, makes a WIS save or is charmed: incapacitated, speed 0. Damage or a friend's Shake awake ends it. Sleepers and the fallen can't see it. A cube, as SRD 5.2 says: the user's call, keep it (a circle would be a one-word change in `Actions`).
- **Haste** (3rd, concentration): a willing creature within 30 ft: speed doubled, +2 AC, advantage on DEX saves, and an extra action each turn for one weapon attack (not a cantrip, not a Multiattack), Dash, or Disengage. The extra action is spent first when it can be. When the spell ends: incapacitated and speed 0 until the end of its next turn. **[S]** The extra action and the doubled speed start on its next turn; Hide and Utilize aren't built. The AI uses the extra action for one more attack.

## 14. Level 2 rules (Step 10a)

- **Hidden** (the rogue's Hide): needs no standing enemy to see you, with solid props (pillars, crates, barrels) blocking sight as well as walls (`Squares.sight(a, b, true)`); a DC 15 Stealth check, whose total is kept. Hidden counts as Invisible: your attacks have advantage, attacks against you disadvantage, and the AI picks someone else if it can. It ends after your next attack roll, or at the start of an enemy's turn if that enemy can see your square and its passive Perception reaches your total. **[S]** No Search action yet.
- **Turned** (Turn Undead): frightened and incapacitated; on its turns it walks as far from the cleric as it can (no actions), opportunity attacks and all. Damage, or the cleric falling, ends it. **[S]** The minute lasts the fight.
- **Action Surge:** usable once your action is spent; it gives the action back. **[S]** The "not a Magic action" limit doesn't come up: the fighter casts no spells.
- **Tactical Mind:** checks outside fights (doors, searching, talking) go through `Explore.rollCheck`, which spends the Second Wind.
- **Paladin's Smite:** the free smite is used before any slot.

## 15. Level 3 rules (Step 10b)

- **Critical range:** an attack roll crits on a natural `opts.critOn` or higher (20; 19 for a Champion's weapon attacks).
- **Potent Cantrip:** actions marked `cantrip`; on a miss, half the damage dice (no extra damage, no condition); on a save, half too. Combat applies it after the miss animation, with POTENT.
- **Healing:** Disciple of Life adds 2 + the slot level to healing spells cast with a slot (not Divine Spark, not Preserve Life). A heal of 0 does nothing (no getting up at 0 HP).
- **Aid** raises the HP maximum (and HP, if above 0) for the fight; Conditions.clear takes it off again. Recasting doesn't stack.
- **Spiritual Weapon** is the caster's `spiritual` condition (its square), drawn by `Shapes.spectralWeapon`; its attacks are melee spell attacks from beside the target (no disadvantage for enemies next to the cleric). **[S]** The strike's 20 ft move and 5 ft reach are one 25 ft range from the hammer.
- **Free movement** (Remarkable Athlete): `turn.freeMove` squares, spent first, with no opportunity attacks.
- **Steady Aim:** the 'aiming' condition until the end of the turn or the next attack; movement goes to 0.
- **Sacred Weapon:** + Cha (minimum 1) to attack rolls with a melee weapon. **[S]** It lasts the fight; the damage stays the weapon's type.

## 16. Level 4 rules (Step 10c)

- **Ability Score Improvement** (`Creatures.improve`): a score goes up by 2 (not past 20), and every number on the sheet from its modifier follows: weapon attacks and damage that use it (Strength unless the weapon says `ability: 'dex'`), the spell attack and save DC, and AC for a creature whose armor adds the full Dex (`acDex`: the rogue's leather, the wizard's none). Saves, skills, initiative, and healing already come from the scores.
- **Spare the Dying:** a friend at 0 HP who isn't dead or stable becomes stable: no more death saves; healing still gets them up.

## 17. Level 5 rules (Step 10d)

- **Proficiency +3** goes into the sheet's precomputed numbers when the level changes (`levelUp`); monsters don't level.
- **Upgrades:** an action's `upgrade: { 5: {...} }` is laid over it for creatures of that level (`Actions.at`), in Rules and in Combat's ranges.
- **Extra Attack:** spending the action on an attack (a weapon, or the breath) leaves `turn.extra = 1`: one more attack, but no spell or Dash. Haste's action and Action Surge stack with it.
- **Free movement** (Tactical Shift, Cunning Strike's Withdraw, Remarkable Athlete): half the speed in `turn.freeMove`, spent first, without opportunity attacks.
- **Poisoned:** disadvantage on attack rolls and ability checks; Cunning Strike's lasts until a CON save at the end of one of its turns (DC stored on the condition).
- **Prone:** its attacks have disadvantage; attacks against it from next to it have advantage, from farther disadvantage. It gets up at the start of its turn, for half its movement.
- **Uncanny Dodge:** the rogue's reaction is used by itself the first time a hit lands in a round (the AI player would always take it).
- **Spirit Guardians:** the caster's 'guardians' condition; checked after every step anyone takes and at every turn's end. **[S]** Half speed applies to a whole turn that starts inside, not to the squares inside; the spirits are always radiant and never touch friends.
- **Revivify:** a hero who died in this fight (slain) gets up with 1 HP. **[S]** No diamond needed.
- **Sear Undead:** one roll for all the undead that fail; it doesn't end the turning.

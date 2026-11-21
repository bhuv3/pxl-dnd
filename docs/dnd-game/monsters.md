# Monsters

Back to [overview.md](overview.md). Rules: [rules.md](rules.md). Looks: [effects.md](effects.md) section 5 (Monsters).

The numbers live in `js/rules/creatures.js` (`Creatures.MONSTERS`); keep the two in step. Built in Step 4: Nimble Escape and goblin tactics (CombatAI). Not built yet: the slime's Split, the boss's Redirect Attack, the cultist fanatic, morale.

The map editor already draws four monster families in code, a different one per seed (`../map-editor/js/render/monsters.js`): skeleton, goblin, slime, cultist. Each gets a stat block here, from the 2024 rules (SRD 5.2, Step 7d). A family member's look (weapon, helmet) can pick its attack: a goblin drawn with a sling uses the sling.

---

## Skeleton (SRD 5.2 Skeleton)

Medium undead. **AC** 14 · **HP** 13 (2d8+4) · **Speed** 30 ft
Str 10 · Dex 16 · Con 15 · Int 6 · Wis 8 · Cha 5
**Vulnerable** bludgeoning · **Immune** poison; exhaustion, poisoned · **Darkvision** 60 ft · **CR** 1/4 (50 XP)

- **Shortsword:** +5 to hit, 1d6+3 piercing.
- **Shortbow:** +5 to hit, range 80/320 ft, 1d6+3 piercing.
- Look → attack: sword, axe, or spear → melee; bow → shortbow.
- Immune to exhaustion, so Sleep never works on it.
- Tactics: walks straight at the nearest hero; archers keep 4+ squares away. Never flees. Turned by Turn Undead.
- Graveyard skeletons with `rise: 1` are underground by day (editor Phase 33): a fight there at night can start with skeletons climbing out.

## Goblin (SRD 5.2 Goblin Warrior), Goblin Minion, Goblin Boss

**Goblin** (the Goblin Warrior block; sheet `goblin`). Small fey (goblinoid). **AC** 15 (leather, shield) · **HP** 10 (3d6) · **Speed** 30 ft
Str 8 · Dex 15 · Con 10 · Int 10 · Wis 8 · Cha 8
**Darkvision** 60 ft · Stealth +6 · **CR** 1/4 (50 XP)

- **Scimitar:** +4 to hit, 1d6+2 slashing, plus 1d4 slashing if the attack roll had advantage.
- **Shortbow:** +4 to hit, range 80/320 ft, 1d6+2 piercing, plus 1d4 piercing with advantage.
- **Nimble Escape** (bonus action): Disengage or Hide.
- Fey, not humanoid: Hold Person doesn't work on goblins.
- Game additions for looks the editor draws (same +4 and +1d4 with advantage): **spear** (1d6+2 piercing), **sling** (30/120 ft, 1d4+2 bludgeoning), **club** (1d4+2 bludgeoning), **burning torch** (1d4+2 fire, can be thrown once and leaves a burning square for 1 round) (club and torch not built).
- Tactics: in groups; hit and hide (Nimble Escape); gang up on the weakest-looking hero; flee when half the group is down (Wis save DC 10 to stay).

**Goblin Minion** (sheet `goblinMinion`). Small fey. **AC** 12 · **HP** 7 (2d6) · Dex 15 · **CR** 1/8 (25 XP)
- **Dagger:** +4 to hit, reach 5 ft or range 20/60 ft, 1d4+2 piercing. Nimble Escape.

**Goblin Boss** (sheet `goblinBoss`). Small fey. **AC** 17 (chain shirt, shield) · **HP** 21 (6d6) · Dex 15 · **CR** 1 (200 XP)
- **Multiattack:** two attacks, Scimitar or Shortbow in any combination (built: two scimitar attacks), each +1d4 with advantage. Nimble Escape.
- **Redirect Attack** (reaction, not built): when attacked, it swaps places with a Small or Medium ally within 5 ft, who becomes the target.

## Slime (game monster, based on the SRD 5.2 Gray Ooze and Ochre Jelly)

The SRD has no "slime", so this is our own, built from the ooze stat blocks. Medium ooze. **AC** 9 · **HP** 22 (3d8+9) · **Speed** 10 ft, climb 10 ft
Str 12 · Dex 6 · Con 16 · Int 1 · Wis 6 · Cha 2
**Resist** acid, cold, fire · **Immune** blinded, charmed, deafened, exhaustion, frightened, grappled, prone, restrained · Blindsight 60 ft · **CR** 1/2 (100 XP)

- **Pseudopod:** +3 to hit, 2d8+1 acid.
- **Acid spit** (game addition, recharge 5–6): range 20 ft, +3 to hit, 2d6 acid; leaves an acid square for 2 rounds (1d4 acid to anyone entering).
- **Split** (like the 2024 Ochre Jelly, a reaction): while Medium with 10+ HP, when it becomes bloodied or takes lightning or slashing damage, it splits into two slimes, each with half the HP (round down).
- **Amorphous:** squeezes through 1-inch gaps (passes under doors).
- Tactics: slow; waits near pools and ambushes; goes for whoever is closest.

## Cultist (SRD 5.2 Cultist) and Cultist Fanatic

**Cultist.** Medium humanoid. **AC** 12 (leather) · **HP** 9 (2d8) · **Speed** 30 ft
Str 11 · Dex 12 · Con 10 · Int 10 · Wis 11 · Cha 10 · Wis save +2 · **CR** 1/8 (25 XP)

- **Ritual Sickle:** +3 to hit, 1d4+1 slashing plus 1 necrotic.
- **Dark bolt** (game addition): +3 to hit, 60 ft, 1d8 necrotic.

**Cultist Fanatic** (the editor's cultists with a glowing staff or book; not built). **AC** 13 · **HP** 44 (8d8+8) · **CR** 2 (450 XP)
Str 11 · Dex 14 · Con 12 · Int 10 · Wis 14 · Cha 13

- **Pact Blade:** +4 to hit, 1d8+2 slashing plus 2d6 necrotic.
- **Spellcasting** (Wis, DC 12, +4): at will Light, Thaumaturgy; 2/day Command; 1/day Hold Person. **Spiritual Weapon** (bonus action, 2/day).
- Tactics: stays behind the cultists near the altar; Hold Person on a fighter first.

## Encounter sizing

The SRD 5.2 XP budget per hero (low / moderate / high difficulty): level 1: 50 / 75 / 100; level 2: 100 / 150 / 200; level 3: 150 / 225 / 400; level 4: 250 / 375 / 500; level 5: 500 / 750 / 1,100. Add up the monsters' XP; there's no multiplier for numbers in the 2024 rules.

Example: three level 1 heroes have a moderate budget of 225 and a high one of 300. Two goblins and the boss (50 + 50 + 200 = 300) is a high-difficulty fight. Use this when placing encounters ([adventures.md](adventures.md)).

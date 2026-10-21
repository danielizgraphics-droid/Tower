// Balance check for the Torre infinita: the bot climbs until it falls.
// Usage: npx vite-node scripts/climb.ts [runs] [talent level]
import { AutoPlayer } from '../src/game/autoplay';
import { Game } from '../src/game/game';
import { ModifierSet } from '../src/game/modifiers';
import { TOWER_LIST } from '../src/data/towers';
import {
  blessingsOf,
  chooseDoor,
  clearFloor,
  floorGold,
  floorMap,
  floorOffset,
  floorRules,
  newClimb,
  resolveRoom,
  takeReward,
} from '../src/meta/climb';
import { buyNode, defaultProfile, profileModifiers, type Profile } from '../src/meta/profile';
import { GENERAL_TREE, MAX_TOWER_LEVEL, TOWER_LEVEL_XP, TOWER_TREES } from '../src/meta/talentTrees';

const [runsArg, level] = process.argv.slice(2);
function profile(lvl: number): Profile {
  const p = defaultProfile();
  p.stars = 1e9;
  for (const t of TOWER_LIST) {
    p.towers[t.id].unlocked = !t.exclusive;
    p.towers[t.id].xp = TOWER_LEVEL_XP[Math.min(MAX_TOWER_LEVEL, lvl)];
  }
  if (lvl > 0) {
    const trees = [GENERAL_TREE, ...TOWER_LIST.map((t) => TOWER_TREES[t.id])];
    for (let pass = 0; pass < 8; pass++) for (const tree of trees) for (const n of tree.nodes) buyNode(p, tree, n.id);
  }
  return p;
}
const p = profile(Number(level ?? 0));
const results: string[] = [];
for (let r = Number(process.env.START ?? 0); r < Number(runsArg ?? 3); r++) {
  const run = newClimb(p, 1000 + r);
  const lives: number[] = [];
  const twists: string[] = [];
  for (;;) {
    const mods: ModifierSet = level ? profileModifiers(p) : new ModifierSet();
    const g = new Game({
      map: floorMap(run),
      difficulty: 'normal',
      mods,
      unlockedTowers: run.towers,
      rules: floorRules(run),
      seed: r * 100 + run.floor,
      waveOffset: floorOffset(run.floor),
    });
    g.maxLives = run.maxLives;
    g.gold = floorGold(run, g.global.startGold);
    for (const a of blessingsOf(run)) {
      g.augments.push(a);
      g.mods.add(a.mods);
    }
    const bot = new AutoPlayer(g, run.towers, 7 + r);
    const leaks: Record<string, number> = {};
    if (process.env.DEBUG) g.events.on('leak', ({ enemy }) => (leaks[enemy.def.id] = (leaks[enemy.def.id] ?? 0) + 1));
    let guard = 0;
    while (g.phase !== 'victory' && g.phase !== 'defeat' && guard++ < 60 * 60 * 30) {
      bot.update(1 / 60);
      if (g.phase === 'build') g.startNextWave();
      g.step(1 / 60);
    }
    if (process.env.DEBUG)
      console.log(
        `  floor ${run.floor} ${g.board.def.theme} spawns ${g.board.spawns.length} routes ${g.board.routes.length} phase ${g.phase} waves ${g.wavesCleared} lives ${g.lives} towers ${g.towers.map((t) => t.def.id + t.tier).join(' ')} leaks ${JSON.stringify(leaks)} roster ${run.towers.join(',')}`,
      );
    if (g.phase !== 'victory') break;
    clearFloor(run, p, g.lives, g.kills);
    lives.push(run.lives);
    // A simple chooser: towers until five, then healing when low, else the first offer.
    while (run.stage === 'reward') {
      const offer = run.offer!;
      const pick =
        (run.towers.length < 5 && offer.find((o) => o.kind === 'tower')) || (run.lives < 10 && offer.find((o) => o.kind === 'heal')) || offer[0];
      takeReward(run, pick);
    }
    // Doors: alternate between the two (twists and rooms get exercised).
    while (run.stage !== 'ready') {
      if (run.stage === 'doors') chooseDoor(run, p, run.doors![run.floor % 2]);
      else if (run.stage === 'room') resolveRoom(run, run.room!.choices.find((c) => c.cost === 0) ?? run.room!.choices[0]);
    }
    twists.push(run.next.mod ?? '-');
    if (run.floor > 60) break;
  }
  results.push(`floors cleared ${run.floor - 1}  lives ${lives.join(',')}  next ${twists.join(',')}`);
  console.log(results[results.length - 1]);
}

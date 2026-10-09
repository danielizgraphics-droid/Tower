import { TOWER_LIST } from '../../data/towers';
import { GENERAL_TREE, TOWER_TREES } from '../../meta/talentTrees';
import { nodeState } from '../../meta/profile';
import type { App, Screen } from '../app';
import { h } from '../dom';
import { icon } from '../icons';
import { BIOME_BY_ID } from '../../data/biomes';
import { loadRun } from '../../meta/runsave';
import { cloudBadge, openSettings } from './settings';

/** True when the player can buy at least one talent somewhere. */
export function hasAffordableTalent(app: App): boolean {
  const p = app.profile;
  if (GENERAL_TREE.nodes.some((n) => nodeState(p, GENERAL_TREE, n) === 'available')) return true;
  for (const t of TOWER_LIST) {
    if (!p.towers[t.id].unlocked) {
      if (p.stars >= t.unlockCost) return true;
      continue;
    }
    const tree = TOWER_TREES[t.id];
    if (tree.nodes.some((n) => nodeState(p, tree, n) === 'available')) return true;
  }
  return false;
}

/** «Continuar partida» when a battle was left between waves (closed or reloaded page). */
function resumeButton(app: App, click: (fn: () => void) => () => void): HTMLElement | null {
  const s = loadRun(app.storage);
  if (!s) return null;
  const wave = s.endless ? `Oleada ${s.wavesCleared + 1}` : `Oleada ${s.wavesCleared + 1}/30`;
  return h(
    'button.btn.big.green.resume',
    { onclick: click(() => app.go({ name: 'game', biome: s.biome, seed: s.seed, difficulty: s.difficulty, endless: s.endless, resume: true })) },
    icon('refresh', 22),
    h(
      'span',
      { style: 'display:flex;flex-direction:column;align-items:flex-start;line-height:1.15' },
      'Continuar partida',
      h('small', { style: 'font-size:12px;font-weight:500;opacity:.85' }, `${BIOME_BY_ID[s.biome]?.name ?? ''} · ${wave}`),
    ),
  );
}

export function menuScreen(app: App): Screen {
  const p = app.profile;
  const click = (fn: () => void) => () => {
    app.sfx('click');
    fn();
  };
  const talentsBtn = h('button.btn.big.purple', { onclick: click(() => app.go({ name: 'talents' })) }, icon('star', 22), 'Talentos');
  if (hasAffordableTalent(app))
    talentsBtn.append(
      h('span', { style: 'position:absolute;top:-6px;right:-6px;width:16px;height:16px;border-radius:50%;background:#e5484d;border:3px solid #fff' }),
    );
  const el = h(
    'div.screen.dim',
    h(
      'div.menu-wrap',
      h(
        'div.logo',
        h('div.kicker', 'Tower Defense'),
        h('h1', 'Bastión Arcano'),
        h('div.tagline', 'Defiende el reino. Cada batalla, un campo distinto.'),
      ),
      h(
        'div.menu-buttons.panel.ornate',
        resumeButton(app, click),
        h('button.btn.big.primary', { onclick: click(() => app.go({ name: 'maps' })) }, icon('play', 22), 'Jugar'),
        talentsBtn,
        h('button.btn.big', { onclick: click(() => app.go({ name: 'codex' })) }, icon('book', 22), 'Códice'),
        h('button.btn.big.wood', { onclick: click(() => openSettings(app, el)) }, icon('gear', 22), 'Ajustes'),
      ),
      h(
        'div.menu-footer',
        h('span.star-badge', icon('star', 18), `${p.stars} estrellas`),
        cloudBadge(app, 'star-badge'),
        p.stats.runs > 0 ? h('span', `${p.stats.wins} victorias · ${p.stats.kills.toLocaleString('es')} enemigos abatidos`) : null,
      ),
    ),
  );
  return { el };
}

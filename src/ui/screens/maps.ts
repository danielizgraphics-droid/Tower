import { DIFFICULTY, MAPS } from '../../data/maps';
import type { Difficulty, MapDef } from '../../data/types';
import { Game } from '../../game/game';
import { ModifierSet } from '../../game/modifiers';
import { isMapUnlocked } from '../../meta/profile';
import { Renderer } from '../../render/renderer';
import type { App, Screen } from '../app';
import { h } from '../dom';
import { icon } from '../icons';

const previews = new Map<string, string>();

/** Renders a still image of a map for its card. */
function mapPreview(def: MapDef): string {
  const hit = previews.get(def.id);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  const game = new Game({ map: def, difficulty: 'normal', mods: new ModifierSet(), unlockedTowers: [] });
  const r = new Renderer(canvas, game);
  r.insets = { top: 0, bottom: 0, left: 4, right: 4 };
  r.view.showDamage = false;
  r.resize(480, 270, 1.5);
  r.render(0.016);
  const url = canvas.toDataURL('image/jpeg', 0.85);
  r.destroy();
  previews.set(def.id, url);
  return url;
}

let lastDifficulty: Difficulty = 'normal';

export function mapsScreen(app: App): Screen {
  const p = app.profile;
  let selected = MAPS.filter((m) => isMapUnlocked(p, m.requires)).pop() ?? MAPS[0];
  let difficulty: Difficulty = lastDifficulty;

  const cards = MAPS.map((m) => {
    const unlocked = isMapUnlocked(p, m.requires);
    const prog = p.maps[m.id];
    const card = h(
      'button.map-card',
      { disabled: !unlocked },
      h('img', { src: mapPreview(m), alt: m.name }),
      h(
        'div.info',
        h('h3', m.name),
        h('span.muted.tiny', m.description),
        h(
          'div',
          { style: 'display:flex;justify-content:space-between;align-items:center;margin-top:6px' },
          h(
            'div.medals',
            (['easy', 'normal', 'hard'] as Difficulty[]).map((d) => h(`span.medal.${d}${prog?.cleared[d] ? '.on' : ''}`, { title: DIFFICULTY[d].name })),
          ),
          unlocked
            ? h('span.pill', prog ? `Récord: ${prog.bestWave}/${m.waves}` : `${m.waves} oleadas`)
            : h('span.pill', icon('lock', 14), `Supera ${MAPS.find((x) => x.id === m.requires)?.name}`),
        ),
      ),
    );
    if (!unlocked) card.classList.add('locked');
    card.onclick = () => {
      if (!unlocked) return;
      app.sfx('click');
      selected = m;
      refresh();
    };
    card.ondblclick = () => unlocked && start();
    return { m, card };
  });

  const diffSeg = h('div.seg');
  const diffInfo = h('span.muted.tiny');
  const startBtn = h('button.btn.big.primary', { onclick: () => start() }, icon('play', 22), 'Comenzar');

  function refresh() {
    for (const c of cards) c.card.classList.toggle('selected', c.m === selected);
    diffSeg.replaceChildren(
      ...(['easy', 'normal', 'hard'] as Difficulty[]).map((d) => {
        const b = h('button', DIFFICULTY[d].name);
        b.classList.toggle('on', d === difficulty);
        b.onclick = () => {
          app.sfx('click');
          difficulty = d;
          lastDifficulty = d;
          refresh();
        };
        return b;
      }),
    );
    const dd = DIFFICULTY[difficulty];
    diffInfo.textContent = `${dd.lives} vidas · vida enemiga ×${dd.hp} · estrellas ×${dd.stars}`;
    startBtn.lastChild!.textContent = `Jugar ${selected.name}`;
  }

  function start() {
    app.sfx('click');
    app.go({ name: 'game', map: selected.id, difficulty });
  }

  refresh();
  const el = h(
    'div.screen.dim',
    h(
      'div.window.panel',
      h(
        'div.window-head',
        h('button.btn.small.icon-only.ghost', { onclick: () => (app.sfx('click'), app.go({ name: 'menu' })), 'aria-label': 'Volver' }, icon('undo', 18)),
        h('h2', 'Elige tu campo de batalla'),
        h('span.star-badge', icon('star', 16), String(p.stars)),
      ),
      h(
        'div.window-body',
        h('div.maps', cards.map((c) => c.card)),
        h('div.difficulty', h('b', 'Dificultad'), diffSeg, diffInfo, h('div', { style: 'flex:1' }), startBtn),
      ),
    ),
  );
  return { el };
}

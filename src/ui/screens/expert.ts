import { BIOME_BY_ID } from '../../data/biomes';
import { DIFFICULTY } from '../../data/maps';
import { EXPERT_MAPS, expertMap, type ExpertDef } from '../../data/expert';
import { EXPERT_UNLOCK_WAVE, expertOpen } from '../../meta/profile';
import { THEMES } from '../../render/theme';
import type { App, Screen } from '../app';
import { h } from '../dom';
import { icon } from '../icons';
import { BIOME_ICON, mapPreview } from './maps';

/** Remembered between visits. */
const state: { id: string; endless: boolean } = { id: EXPERT_MAPS[0].id, endless: false };

/** Why an expert map can't be played yet (null = playable). */
function blocker(app: App, x: ExpertDef): string | null {
  if (x.allWater && !app.profile.towers.harbor.unlocked && !app.profile.towers.tide.unlocked)
    return 'Necesitas una torre naval (Puerto o Marea) para defender el mar abierto.';
  return null;
}

export function expertScreen(app: App): Screen {
  const p = app.profile;
  const open = expertOpen(p);
  const img = h('img', { alt: 'Vista previa del mapa' });
  const mapName = h('h3');
  const tagsEl = h('span.seed');
  const list = h('div.biomes');
  const modeSeg = h('div.seg');
  const desc = h('p');
  const records = h('div.records');
  const note = h('p.muted.tiny');
  const startBtn = h('button.btn.big.red', icon('swords', 22), 'Partir a la batalla');
  const summary = h('div.start-summary');

  const current = () => EXPERT_MAPS.find((x) => x.id === state.id) ?? EXPERT_MAPS[0];

  function refreshPreview() {
    const x = current();
    mapName.textContent = x.name;
    tagsEl.textContent = x.tags.join(' · ');
    mapPreview(expertMap(x, 30), (url) => (img.src = url));
  }

  function render() {
    const x = current();
    list.replaceChildren(
      ...EXPERT_MAPS.map((m) => {
        const prog = p.maps[m.id];
        const card = h(
          'button.biome',
          { disabled: !open },
          h('span.swatch', { style: `background:${THEMES[m.biome].grassDark}` }, icon(open ? BIOME_ICON[m.biome] : 'lock', 20)),
          h('h3', m.name),
          h(
            'div.meta',
            prog?.cleared.hard ? h('span.medal.hard.on', { title: 'Superado' }) : null,
            h('span', prog ? `Récord ${prog.bestWave}/30${prog.bestEndless ? ` · ∞ ${prog.bestEndless}` : ''}` : m.tags[0]),
          ),
        );
        card.classList.toggle('on', m.id === state.id);
        card.onclick = () => {
          if (m.id === state.id) return;
          app.sfx('click');
          state.id = m.id;
          render();
          refreshPreview();
        };
        return card;
      }),
    );
    modeSeg.replaceChildren(
      ...(
        [
          ['Campaña', '30 oleadas', false],
          ['Infinito', 'Sin final', true],
        ] as const
      ).map(([label, sub, endless]) => {
        const b = h('button', label, h('small', sub));
        b.classList.toggle('on', state.endless === endless);
        b.onclick = () => {
          app.sfx('click');
          state.endless = endless;
          render();
        };
        return b;
      }),
    );
    const region = BIOME_BY_ID[x.biome];
    desc.textContent = `${x.description} Región: ${region.name}. Vida enemiga ×${(region.hpScale * x.hp).toFixed(2)}.`;
    const prog = p.maps[x.id];
    records.replaceChildren(
      h('div.record', 'Mejor campaña', h('b', prog ? `${prog.bestWave}/30` : '—')),
      h('div.record', 'Récord infinito', h('b', prog?.bestEndless ? `${prog.bestEndless} oleadas` : '—')),
    );
    const why = !open ? `Llega a la oleada ${EXPERT_UNLOCK_WAVE} en la campaña de cualquier región para abrir el modo experto.` : blocker(app, x);
    note.textContent = why ?? '';
    startBtn.toggleAttribute('disabled', !!why);
    summary.replaceChildren(h('b', x.name), h('span', `${state.endless ? 'Infinito' : 'Campaña'} · Experto`));
  }

  startBtn.onclick = () => {
    app.sfx('click');
    const x = current();
    app.go({ name: 'game', biome: x.biome, seed: x.seed, difficulty: 'hard', endless: state.endless, expert: x.id });
  };

  render();
  refreshPreview();

  const el = h(
    'div.screen.dim',
    h(
      'div.window.panel',
      h(
        'div.window-head',
        h(
          'button.btn.small.icon-only.wood',
          { onclick: () => (app.sfx('click'), app.go({ name: 'menu' })), 'aria-label': 'Volver' },
          icon('undo', 18),
        ),
        h('h2', 'Modo experto'),
        h('span.star-badge', icon('skull', 16), `${EXPERT_MAPS.filter((m) => p.maps[m.id]?.cleared.hard).length}/${EXPERT_MAPS.length}`),
      ),
      h(
        'div.window-body',
        h(
          'div.expedition',
          h(
            'div',
            { style: 'min-width:0' },
            h('div.preview-frame', img, h('div.map-name', h('div', mapName, tagsEl))),
            h('div.section-title', { style: 'margin-top:16px' }, 'Mapas expertos'),
            list,
          ),
          h(
            'div.options',
            h(
              'div.option-group',
              h('b', 'Qué te espera'),
              h(
                'p',
                `Mapas con varias entradas y caminos que se bifurcan: los enemigos se reparten entre todas las rutas y ninguna defensa llega a cubrirlas todas. Dificultad ${DIFFICULTY.hard.name} (${DIFFICULTY.hard.lives} vidas) y estrellas extra.`,
              ),
            ),
            h('div.option-group', h('b', 'Modo'), modeSeg),
            h('div.option-group', h('b', 'Mapa'), records, desc, note),
          ),
        ),
      ),
      h('div.window-foot', summary, startBtn),
    ),
  );
  return { el };
}

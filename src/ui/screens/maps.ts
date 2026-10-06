import { BIOMES, BIOME_BY_ID, type Biome } from '../../data/biomes';
import { DIFFICULTY } from '../../data/maps';
import type { Difficulty } from '../../data/types';
import { Game } from '../../game/game';
import { generateMap, seedCode } from '../../game/mapgen';
import { ModifierSet } from '../../game/modifiers';
import { isMapUnlocked, UNLOCK_WAVE } from '../../meta/profile';
import { Renderer } from '../../render/renderer';
import { THEMES } from '../../render/theme';
import type { App, Screen } from '../app';
import { h } from '../dom';
import { icon } from '../icons';

const BIOME_ICON: Record<Biome, string> = {
  meadow: 'clover',
  coast: 'wave',
  autumn: 'flame',
  desert: 'hourglass',
  swamp: 'flask',
  snow: 'snow',
  volcano: 'burst',
  dusk: 'skull',
};

let previewToken = 0;

/**
 * Renders a still image of a generated map (in 3D when available, compositing
 * the WebGL layer under the 2D overlay). Older pending requests are dropped.
 */
function mapPreview(biome: Biome, seed: number, done: (url: string) => void): void {
  const token = ++previewToken;
  const canvas = document.createElement('canvas');
  const def = generateMap({ biome, seed });
  const game = new Game({ map: def, difficulty: 'normal', mods: new ModifierSet(), unlockedTowers: [] });
  const r = new Renderer(canvas, game);
  r.insets = { top: 10, bottom: 70, left: 10, right: 10 };
  r.view.showDamage = false;
  r.paintBackground = !r.has3D;
  r.resize(640, 400, Math.min(2, window.devicePixelRatio || 1));
  r.setZoom(1);
  let waited = 0;
  let settled = 0;
  const step = () => {
    if (token !== previewToken) return r.destroy();
    r.render(0.016);
    // Wait (up to ~5 s) for the 3D terrain; a few extra frames let the models settle.
    if (r.has3D && waited++ < 300 && (!r.layer3D || settled++ < 2)) {
      requestAnimationFrame(step);
      return;
    }
    const out = document.createElement('canvas');
    out.width = canvas.width;
    out.height = canvas.height;
    const ctx = out.getContext('2d')!;
    ctx.fillStyle = '#8fd3a0';
    ctx.fillRect(0, 0, out.width, out.height);
    if (r.layer3D) ctx.drawImage(r.layer3D, 0, 0, out.width, out.height);
    ctx.drawImage(canvas, 0, 0);
    done(out.toDataURL('image/jpeg', 0.88));
    r.destroy();
  };
  step();
}

const newSeed = () => (Math.random() * 2 ** 31) >>> 0;

// Remembered between visits during a session.
const state: { biome: Biome | null; seed: number; difficulty: Difficulty; endless: boolean } = {
  biome: null,
  seed: newSeed(),
  difficulty: 'normal',
  endless: false,
};

export function mapsScreen(app: App): Screen {
  const p = app.profile;
  const unlocked = (b: Biome) => isMapUnlocked(p, BIOME_BY_ID[b].requires);
  if (!state.biome || !unlocked(state.biome)) state.biome = [...BIOMES].reverse().find((b) => unlocked(b.id))?.id ?? 'meadow';

  const img = h('img', { alt: 'Vista previa del mapa' });
  const mapName = h('h3');
  const seedEl = h('span.seed');
  const biomeList = h('div.biomes');
  const modeSeg = h('div.seg');
  const diffSeg = h('div.seg');
  const records = h('div.records');
  const biomeDesc = h('p');
  const startBtn = h('button.btn.big.primary', { style: 'width:100%' }, icon('swords', 22), 'Partir a la batalla');

  function refreshPreview() {
    const def = generateMap({ biome: state.biome!, seed: state.seed });
    mapName.textContent = def.name;
    seedEl.textContent = `Mapa #${seedCode(state.seed)}`;
    mapPreview(state.biome!, state.seed, (url) => (img.src = url));
  }

  function render() {
    const b = BIOME_BY_ID[state.biome!];
    biomeList.replaceChildren(
      ...BIOMES.map((bd) => {
        const open = unlocked(bd.id);
        const prog = p.maps[bd.id];
        const theme = THEMES[bd.id];
        const card = h(
          'button.biome',
          { disabled: !open },
          h('span.swatch', { style: `background:${theme.grassDark}` }, icon(open ? BIOME_ICON[bd.id] : 'lock', 20)),
          h('h3', bd.name),
          h(
            'div.meta',
            open
              ? [
                  h(
                    'span.medals',
                    (['easy', 'normal', 'hard'] as Difficulty[]).map((d) =>
                      h(`span.medal.${d}${prog?.cleared[d] ? '.on' : ''}`, { title: DIFFICULTY[d].name }),
                    ),
                  ),
                  prog?.bestEndless ? h('span', `∞ ${prog.bestEndless}`) : null,
                ]
              : h('span', `Oleada ${UNLOCK_WAVE} en ${BIOME_BY_ID[bd.requires!].name}`),
          ),
        );
        card.classList.toggle('on', bd.id === state.biome);
        card.onclick = () => {
          if (!open || bd.id === state.biome) return;
          app.sfx('click');
          state.biome = bd.id;
          state.seed = newSeed();
          render();
          refreshPreview();
        };
        return card;
      }),
    );
    const seg = (el: HTMLElement, items: { label: string; sub: string; on: boolean; pick: () => void }[]) =>
      el.replaceChildren(
        ...items.map((it) => {
          const btn = h('button', it.label, h('small', it.sub));
          btn.classList.toggle('on', it.on);
          btn.onclick = () => {
            app.sfx('click');
            it.pick();
            render();
          };
          return btn;
        }),
      );
    seg(modeSeg, [
      { label: 'Campaña', sub: '30 oleadas', on: !state.endless, pick: () => (state.endless = false) },
      { label: 'Infinito', sub: 'Sin final', on: state.endless, pick: () => (state.endless = true) },
    ]);
    seg(
      diffSeg,
      (['easy', 'normal', 'hard'] as Difficulty[]).map((d) => ({
        label: DIFFICULTY[d].name,
        sub: `${DIFFICULTY[d].lives} vidas`,
        on: state.difficulty === d,
        pick: () => (state.difficulty = d),
      })),
    );
    const prog = p.maps[b.id];
    records.replaceChildren(
      h('div.record', 'Mejor campaña', h('b', prog ? `${prog.bestWave}/30` : '—')),
      h('div.record', 'Récord infinito', h('b', prog?.bestEndless ? `${prog.bestEndless} oleadas` : '—')),
    );
    biomeDesc.textContent = `${b.description} Vida enemiga ×${b.hpScale}.`;
  }

  startBtn.onclick = () => {
    app.sfx('click');
    app.go({ name: 'game', biome: state.biome!, seed: state.seed, difficulty: state.difficulty, endless: state.endless });
  };
  const reroll = h(
    'button.btn.small.wood.reroll',
    {
      onclick: () => {
        app.sfx('click');
        state.seed = newSeed();
        refreshPreview();
      },
    },
    icon('refresh', 16),
    'Otro mapa',
  );

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
        h('h2', 'Nueva expedición'),
        h('span.star-badge', icon('star', 16), String(p.stars)),
      ),
      h(
        'div.window-body',
        h(
          'div.expedition',
          h(
            'div',
            { style: 'min-width:0' },
            h('div.preview-frame', img, reroll, h('div.map-name', h('div', mapName, seedEl))),
            h('div.section-title', { style: 'margin-top:16px' }, 'Región'),
            biomeList,
          ),
          h(
            'div.options',
            h(
              'div.option-group',
              h('b', 'Modo'),
              modeSeg,
              h('p', 'En el modo infinito las oleadas no terminan nunca: cada 10 llega un jefe y los enemigos se hacen cada vez más fuertes.'),
            ),
            h('div.option-group', h('b', 'Dificultad'), diffSeg),
            h('div.option-group', h('b', 'Registro de la región'), records, biomeDesc),
            startBtn,
          ),
        ),
      ),
    ),
  );
  return { el };
}

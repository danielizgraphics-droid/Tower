import { AUGMENT_MAP, RARITY_INFO } from '../../data/augments';
import { TOWERS } from '../../data/towers';
import {
  blessingsOf,
  CLIMB_LIVES,
  clearClimb,
  FLOOR_WAVES,
  isBossFloor,
  loadClimb,
  newClimb,
  saveClimb,
  takeReward,
  type ClimbRun,
  type Reward,
} from '../../meta/climb';
import { leaderboard, type BoardKind } from '../../meta/leaderboard';
import { towerPortrait } from '../../render/portraits';
import type { App, Screen } from '../app';
import { h } from '../dom';
import { icon } from '../icons';

/** Waves to reach in any region before the climb opens. */
export const CLIMB_UNLOCK_WAVE = 10;

export function climbOpen(app: App): boolean {
  return Object.values(app.profile.maps).some((m) => m.bestWave >= CLIMB_UNLOCK_WAVE || (m.bestEndless ?? 0) >= CLIMB_UNLOCK_WAVE);
}

/** One reward as a big tappable card. */
function rewardCard(r: Reward, pick: () => void): HTMLElement {
  let art: HTMLElement;
  let title: string;
  let sub: string;
  let color = '#e2a01e';
  if (r.kind === 'tower') {
    art = h('img', { src: towerPortrait(r.tower, 1, -1, 64), alt: '' });
    title = TOWERS[r.tower].name;
    sub = 'Nueva torre para esta escalada';
  } else if (r.kind === 'blessing') {
    const a = AUGMENT_MAP[r.id];
    color = RARITY_INFO[a.rarity].color;
    art = h('span.reward-icon', { style: `background:${color}` }, icon(a.icon, 30));
    title = a.name;
    sub = `${RARITY_INFO[a.rarity].name} · ${a.description}`;
  } else if (r.kind === 'heal') {
    color = '#e5484d';
    art = h('span.reward-icon', { style: `background:${color}` }, icon('heart', 30));
    title = `+${r.lives} vidas`;
    sub = 'Recupera vidas perdidas';
  } else {
    art = h('span.reward-icon', { style: `background:${color}` }, icon('coins', 30));
    title = `+${r.gold} de oro inicial`;
    sub = 'En cada piso que te quede';
  }
  const b = h('button.climb-reward', { style: `--accent:${color}` }, art, h('b', title), h('span', sub));
  b.onclick = pick;
  return b;
}

/** The choice after a floor: pick one, then the next floor starts. */
export function rewardPicker(app: App, run: ClimbRun, done: () => void): HTMLElement {
  return h(
    'div.climb-rewards',
    (run.offer ?? []).map((r) =>
      rewardCard(r, () => {
        app.sfx('click');
        takeReward(run, r);
        saveClimb(app.storage, run);
        done();
      }),
    ),
  );
}

export function startFloor(app: App, run: ClimbRun): void {
  app.go({ name: 'game', biome: 'meadow', seed: run.seed + run.floor, difficulty: 'normal', endless: false, climb: true });
}

/** Summary chips of a climb in progress: lives, towers and blessings. */
export function runSummary(run: ClimbRun): HTMLElement {
  return h(
    'div.climb-run',
    h(
      'div.climb-stats',
      h('span.pill', icon('tower', 16), `Piso ${run.floor}`),
      h('span.pill', { style: 'color:#e5484d' }, icon('heart', 16), `${run.lives}/${CLIMB_LIVES}`),
      run.goldBonus ? h('span.pill', { style: 'color:#b98317' }, icon('coins', 16), `+${run.goldBonus} oro`) : null,
      isBossFloor(run.floor) ? h('span.pill', { style: 'color:#a3362a' }, icon('skull', 16), 'Piso de jefe') : null,
    ),
    h(
      'div.climb-towers',
      run.towers.map((id) => h('img', { src: towerPortrait(id, 1, -1, 48), alt: TOWERS[id].name, title: TOWERS[id].name })),
    ),
    blessingsOf(run).length
      ? h(
          'div.climb-blessings',
          blessingsOf(run).map((a) =>
            h('span.pill', { style: `color:${RARITY_INFO[a.rarity].color}`, title: a.description }, icon(a.icon, 14), a.name),
          ),
        )
      : null,
  );
}

/** Remembered between visits. */
const view: { board: BoardKind } = { board: 'floor' };

export function climbScreen(app: App): Screen {
  const p = app.profile;
  const open = climbOpen(app);
  const left = h('div', { style: 'min-width:0;display:flex;flex-direction:column;gap:14px' });
  const startBtn = h('button.btn.big.purple', icon('tower', 22), 'Empezar escalada');
  const summary = h('div.start-summary');
  const ranking = h('div.ranking');
  const boardSeg = h('div.seg');
  const nick = h('input.nick', {
    type: 'text',
    maxlength: '20',
    placeholder: 'Tu nombre en la clasificación',
    value: p.climb.nick,
  }) as HTMLInputElement;
  const nickRow = h('div.nick-row', nick);
  let destroyed = false;

  function renderLeft() {
    const run = loadClimb(app.storage);
    left.replaceChildren();
    if (run?.offer) {
      left.append(
        h('div.section-title', `¡Piso ${run.floor - 1} superado! Elige una recompensa`),
        rewardPicker(app, run, () => renderLeft()),
        runSummary(run),
      );
      startBtn.toggleAttribute('disabled', true);
    } else if (run) {
      left.append(h('div.section-title', 'Escalada en curso'), runSummary(run));
      const quit = h('button.btn.small.wood', icon('trash', 16), 'Abandonar escalada');
      quit.onclick = () => {
        app.sfx('click');
        clearClimb(app.storage);
        renderLeft();
      };
      left.append(h('div', quit));
      startBtn.toggleAttribute('disabled', false);
    } else startBtn.toggleAttribute('disabled', !open);
    if (!run)
      left.append(
        h('div.section-title', 'Cómo funciona'),
        h(
          'ul.climb-rules',
          h('li', `Cada piso es una batalla corta de ${FLOOR_WAVES} oleadas en un mapa nuevo. Cuanto más subes, más fuertes son los enemigos.`),
          h('li', 'Empiezas con 3 de tus torres. Tras cada piso eliges una recompensa: torres nuevas, bendiciones, vidas u oro.'),
          h('li', `Las vidas no se recuperan solas: empiezas con ${CLIMB_LIVES} y la escalada termina en tu primera derrota.`),
          h('li', 'Cada piso da experiencia a tus torres y, al terminar, estrellas según lo alto que llegues.'),
        ),
      );
    if (!run && !open) left.append(h('p.muted', `Llega a la oleada ${CLIMB_UNLOCK_WAVE} en cualquier región para abrir la torre.`));
    startBtn.replaceChildren(icon(run ? 'play' : 'tower', 22), run ? `Subir al piso ${run.floor}` : 'Empezar escalada');
    summary.replaceChildren(h('b', 'Torre infinita'), h('span', `Récord: ${p.climb.best ? `piso ${p.climb.best}` : '—'}`));
  }

  async function renderRanking() {
    boardSeg.replaceChildren(
      ...(
        [
          ['floor', 'Torre infinita'],
          ['endless', 'Modo infinito'],
        ] as const
      ).map(([id, label]) => {
        const b = h('button', label);
        b.classList.toggle('on', view.board === id);
        b.onclick = () => {
          app.sfx('click');
          view.board = id;
          void renderRanking();
        };
        return b;
      }),
    );
    ranking.replaceChildren(h('p.muted', 'Cargando clasificación…'));
    const kind = view.board;
    await leaderboard.submit(p);
    const rows = await leaderboard.top(kind);
    if (destroyed || kind !== view.board) return;
    if (!rows) {
      nickRow.style.display = 'none';
      ranking.replaceChildren(
        h('p.muted', 'La clasificación online está disponible al jugar desde la versión de Claude, con tu cuenta.'),
        h('p.muted.tiny', `Tus récords: piso ${p.climb.best || '—'} en la torre.`),
      );
      return;
    }
    if (!rows.length) {
      ranking.replaceChildren(h('p.muted', '¡Nadie ha puntuado todavía! Sé el primero.'));
      return;
    }
    let rank = 0;
    let last = -1;
    ranking.replaceChildren(
      h(
        'ol.rank-list',
        rows.map((r, i) => {
          const v = kind === 'floor' ? r.floor : r.endless;
          if (v !== last) rank = i + 1;
          last = v;
          const name = h('span.name');
          name.textContent = r.name;
          return h(
            `li${r.me ? '.me' : ''}`,
            h('span.pos', rank <= 3 ? icon('medal', 16) : String(rank)),
            name,
            h('b', kind === 'floor' ? `Piso ${v}` : `${v} oleadas`),
          );
        }),
      ),
    );
  }

  let nickTimer = 0;
  nick.oninput = () => {
    p.climb.nick = nick.value.replace(/[\u0000-\u001f]/g, '').slice(0, 20);
    app.save();
    clearTimeout(nickTimer);
    nickTimer = window.setTimeout(() => void renderRanking(), 1200);
  };

  startBtn.onclick = () => {
    app.sfx('click');
    let run = loadClimb(app.storage);
    if (!run) {
      run = newClimb(p);
      p.climb.runs++;
      app.save();
      saveClimb(app.storage, run);
    }
    startFloor(app, run);
  };

  renderLeft();
  void renderRanking();

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
        h('h2', 'Torre infinita'),
        h('span.star-badge', icon('tower', 16), p.climb.best ? `Piso ${p.climb.best}` : '—'),
      ),
      h(
        'div.window-body',
        h('div.expedition', left, h('div.options', h('div.option-group', h('b', 'Clasificación online'), boardSeg, nickRow, ranking))),
      ),
      h('div.window-foot', summary, startBtn),
    ),
  );
  return {
    el,
    destroy() {
      destroyed = true;
      clearTimeout(nickTimer);
    },
  };
}

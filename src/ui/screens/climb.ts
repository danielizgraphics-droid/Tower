import { AUGMENT_MAP, RARITY_INFO } from '../../data/augments';
import { TOWERS } from '../../data/towers';
import {
  ACHIEVEMENTS,
  blessingsOf,
  checkAchievements,
  chooseDoor,
  clearClimb,
  FLOOR_MODS,
  FLOOR_WAVES,
  isBossFloor,
  loadClimb,
  MILESTONES,
  newClimb,
  resolveRoom,
  ROOMS,
  saveClimb,
  takeReward,
  type Achievement,
  type ClimbRun,
  type Door,
  type Reward,
  type RoomChoice,
} from '../../meta/climb';
import { leaderboard, type BoardKind } from '../../meta/leaderboard';
import { towerPortrait } from '../../render/portraits';
import type { App, Screen } from '../app';
import { h } from '../dom';
import { icon } from '../icons';
import { nickField } from '../nick';

/** Waves to reach in any region before the climb opens. */
export const CLIMB_UNLOCK_WAVE = 10;

export function climbOpen(app: App): boolean {
  return Object.values(app.profile.maps).some((m) => m.bestWave >= CLIMB_UNLOCK_WAVE || (m.bestEndless ?? 0) >= CLIMB_UNLOCK_WAVE);
}

/** One reward (or room choice) as a big tappable card. */
function rewardCard(r: Reward | null, pick: () => void, cost = 0): HTMLElement {
  let art: HTMLElement;
  let title: string;
  let sub: string;
  let color = '#e2a01e';
  if (!r) {
    color = '#8a8a8a';
    art = h('span.reward-icon', { style: `background:${color}` }, icon('undo', 30));
    title = 'Marcharse';
    sub = 'No aceptar ningún pacto';
  } else if (r.kind === 'tower') {
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
  const b = h(
    'button.climb-reward',
    { style: `--accent:${color}` },
    art,
    h('b', title),
    h('span', sub),
    cost ? h('span.cost', icon('heart', 13), `Cuesta ${cost} vidas`) : null,
  );
  b.onclick = pick;
  return b;
}

/** A door to the next floor: a plain battle, a battle with a twist (double loot), or a room. */
function doorCard(run: ClimbRun, d: Door, pick: () => void): HTMLElement {
  let title: string;
  let sub: string;
  let ic: string;
  let tag: string | null = null;
  let color: string;
  if (d.kind === 'room') {
    const r = ROOMS[d.room];
    title = r.name;
    sub = r.text;
    ic = r.icon;
    color = '#3aa0c8';
  } else if (d.mod) {
    const m = FLOOR_MODS[d.mod];
    title = m.name;
    sub = m.text;
    ic = m.icon;
    tag = 'Botín doble';
    color = '#c06bff';
  } else {
    title = 'Paso firme';
    sub = 'Un piso sin sorpresas.';
    ic = 'swords';
    color = '#2f7d5b';
  }
  const boss = d.kind === 'battle' && isBossFloor(run.floor);
  const b = h(
    'button.climb-door',
    { style: `--accent:${color}` },
    h('span.door-arch', icon(ic, 30)),
    h('b', title),
    h('span', sub),
    boss ? h('span.cost', { style: 'color:#a3362a' }, icon('skull', 13), 'Te espera un guardián') : null,
    tag ? h('span.door-tag', icon('gem', 12), tag) : null,
  );
  b.onclick = pick;
  return b;
}

/** Achievements just earned, as pills. */
function feats(list: Achievement[]): HTMLElement | null {
  return list.length
    ? h(
        'div.climb-feats',
        list.map((a) => h('span.pill.mission-reward', icon('medal', 16), `¡Logro «${a.name}»! +${a.stars} estrellas`)),
      )
    : null;
}

/**
 * Everything between two floors, step by step: the reward(s) after a battle,
 * the two doors, and the room behind one if chosen. Calls `ready` once the
 * next battle is decided.
 */
export function intermission(app: App, run: ClimbRun, ready: () => void, earned: Achievement[] = []): HTMLElement {
  const box = h('div.intermission');
  const p = app.profile;
  let news = earned;
  const commit = () => {
    news = [...news, ...checkAchievements(run, p)];
    saveClimb(app.storage, run);
    app.save();
    render();
  };
  function render() {
    box.replaceChildren();
    const f = feats(news);
    if (f) box.append(f);
    if (run.stage === 'reward' && run.offer) {
      box.append(
        h('p.muted', run.picks > 1 ? `Botín doble: elige ${run.picks} recompensas.` : 'Elige una recompensa.'),
        h(
          'div.climb-rewards',
          run.offer.map((r) =>
            rewardCard(r, () => {
              app.sfx('click');
              takeReward(run, r);
              commit();
            }),
          ),
        ),
      );
    } else if (run.stage === 'doors' && run.doors) {
      box.append(
        h('p.muted', `Dos puertas llevan al piso ${run.floor}. ¿Cuál cruzas?`),
        h(
          'div.climb-doors',
          run.doors.map((d) =>
            doorCard(run, d, () => {
              app.sfx('click');
              chooseDoor(run, p, d);
              commit();
            }),
          ),
        ),
      );
    } else if (run.stage === 'room' && run.room) {
      const r = ROOMS[run.room.kind];
      box.append(
        h('h3', { style: 'margin:4px 0' }, r.name),
        h('p.muted', r.text),
        h(
          'div.climb-rewards',
          run.room.choices.map((c: RoomChoice) =>
            rewardCard(
              c.reward,
              () => {
                app.sfx(c.cost ? 'augment' : 'click');
                resolveRoom(run, c);
                commit();
              },
              c.cost,
            ),
          ),
        ),
      );
    } else ready();
  }
  render();
  return box;
}

export function startFloor(app: App, run: ClimbRun): void {
  app.go({ name: 'game', biome: 'keep', seed: run.seed + run.floor, difficulty: 'normal', endless: false, climb: true });
}

/** Summary chips of a climb in progress: lives, towers and blessings. */
export function runSummary(run: ClimbRun): HTMLElement {
  const mod = run.stage === 'ready' && run.next.mod ? FLOOR_MODS[run.next.mod] : null;
  return h(
    'div.climb-run',
    h(
      'div.climb-stats',
      h('span.pill', icon('tower', 16), `Piso ${run.floor}`),
      h('span.pill', { style: 'color:#e5484d' }, icon('heart', 16), `${run.lives}/${run.maxLives}`),
      run.goldBonus ? h('span.pill', { style: 'color:#b98317' }, icon('coins', 16), `+${run.goldBonus} oro`) : null,
      run.stage === 'ready' && isBossFloor(run.floor) ? h('span.pill', { style: 'color:#a3362a' }, icon('skull', 16), 'Guardián') : null,
      mod ? h('span.pill', { style: 'color:#9a4fd0', title: mod.text }, icon(mod.icon, 16), mod.name) : null,
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

/** Heights and feats: what the climb has to offer beyond the next floor. */
function progressPanel(app: App, run: ClimbRun | null): HTMLElement {
  const p = app.profile;
  return h(
    'div.climb-progress',
    h('div.section-title', 'Hitos de altura'),
    h(
      'div.milestones',
      MILESTONES.map((m) => {
        const done = p.climb.best >= m.floor;
        return h(
          `div.milestone${done ? '.done' : ''}`,
          h('span.ms-floor', done ? icon('check', 16) : String(m.floor)),
          h('span.ms-text', h('b', `Piso ${m.floor}`), m.text),
          h('span.ms-stars', icon('star', 13), String(m.stars)),
        );
      }),
    ),
    h('div.section-title', `Logros · ${p.climb.achievements.length}/${ACHIEVEMENTS.length}`),
    h(
      'div.achievements',
      ACHIEVEMENTS.map((a) => {
        const done = p.climb.achievements.includes(a.id);
        const [have, need] = a.progress(run, p);
        return h(
          `div.achievement${done ? '.done' : ''}`,
          h('span.ach-icon', icon(done ? 'medal' : 'lock', 18)),
          h('span.ach-text', h('b', a.name), a.text, !done && have > 0 ? h('small', ` (${Math.min(have, need)}/${need})`) : null),
          h('span.ms-stars', icon('star', 13), String(a.stars)),
        );
      }),
    ),
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
  const nickRow = nickField(app, () => void renderRanking());

  let destroyed = false;

  function renderLeft() {
    const run = loadClimb(app.storage);
    left.replaceChildren();
    if (run && run.stage !== 'ready') {
      left.append(
        h('div.section-title', run.stage === 'reward' ? `¡Piso ${run.floor - 1} superado!` : 'Entre pisos'),
        intermission(app, run, () => renderLeft()),
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
          h('li', `Cada piso es una batalla corta de ${FLOOR_WAVES} oleadas en lo alto de la torre. Cuanto más subes, más fuertes son los enemigos.`),
          h(
            'li',
            'Tras cada piso eliges una recompensa y luego una de dos puertas: un piso con giro (Horda, Niebla, Élite…) que da botín doble, o salas sin batalla: tesoro, altar o fuente.',
          ),
          h('li', 'Las vidas apenas se recuperan entre pisos y la escalada termina en tu primera derrota.'),
          h('li', 'Cada altura nueva desbloquea ventajas para siempre, y las hazañas dan logros con estrellas.'),
        ),
      );
    if (!run && !open) left.append(h('p.muted', `Llega a la oleada ${CLIMB_UNLOCK_WAVE} en cualquier región para abrir la torre.`));
    left.append(progressPanel(app, run));
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
          // The Crown of the Tower (floor 30) shows in every ranking.
          return h(
            `li${r.me ? '.me' : ''}`,
            h('span.pos', rank <= 3 ? icon('medal', 16) : String(rank)),
            r.floor >= 30 ? h('span.crowned', { title: 'Corona de la Torre' }, icon('crown', 15)) : null,
            name,
            h('b', kind === 'floor' ? `Piso ${v}` : `${v} oleadas`),
          );
        }),
      ),
    );
  }

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
    },
  };
}

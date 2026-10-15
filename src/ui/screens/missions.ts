import { BIOME_BY_ID } from '../../data/biomes';
import { DIFFICULTY } from '../../data/maps';
import { CHAPTERS, MISSIONS, MISSION_BY_ID, ruleLines, type MissionDef } from '../../data/missions';
import { TOWERS } from '../../data/towers';
import { MASTERY_TOWERS } from '../../data/mastery';
import type { TowerId } from '../../data/types';
import { missionAvailable, towerMastered } from '../../meta/profile';
import { towerPortrait } from '../../render/portraits';
import { THEMES } from '../../render/theme';
import type { App, Screen } from '../app';
import { h } from '../dom';
import { icon } from '../icons';

/** Missions that can be played now and haven't been completed (for the menu badge). */
export function pendingMissions(app: App): number {
  const p = app.profile;
  return MISSIONS.filter((m) => m.chapter >= 0 && !p.missions[m.id]?.done && missionAvailable(p, m)).length;
}

function rewardChip(m: MissionDef): HTMLElement {
  const r = m.reward;
  if (r.mastery)
    return h(
      'span.reward.tower',
      h('span.dot', { style: 'background:#e2a01e' }, icon('crown', 16)),
      h('span', h('small', 'Maestría'), `${TOWERS[r.mastery].name} dorada`),
    );
  if (r.tower)
    return h(
      'span.reward.tower',
      h('img', { src: towerPortrait(r.tower, 1, -1, 48), alt: '' }),
      h('span', h('small', 'Torre exclusiva'), TOWERS[r.tower].name),
    );
  if (r.region)
    return h(
      'span.reward.region',
      h('span.dot', { style: `background:${THEMES[r.region].grassDark}` }, icon('map', 16)),
      h('span', h('small', 'Región exclusiva'), BIOME_BY_ID[r.region].name),
    );
  return h('span.reward', h('span.dot.star', icon('star', 16)), h('span', h('small', 'Recompensa'), `${r.stars} estrellas`));
}

/** Remembered between visits. */
const view: { tab: 'story' | 'mastery'; tower: TowerId | null } = { tab: 'story', tower: null };

export function missionsScreen(app: App): Screen {
  const p = app.profile;
  const body = h('div.missions');

  function missionCard(m: MissionDef): HTMLElement {
    const isDone = !!p.missions[m.id]?.done;
    const open = missionAvailable(p, m);
    const missing = m.requires.filter((id) => !p.missions[id]?.done).map((id) => MISSION_BY_ID[id].name);
    const play = h(
      `button.btn.${isDone ? 'green' : 'primary'}`,
      { disabled: !open },
      icon(open ? (isDone ? 'refresh' : 'swords') : 'lock', 18),
      open ? (isDone ? 'Repetir' : 'Jugar') : 'Bloqueada',
    );
    play.onclick = () => {
      app.sfx('click');
      app.go({ name: 'game', biome: m.biome, seed: m.seed, difficulty: m.difficulty, endless: false, mission: m.id });
    };
    const needs = m.needsTower && !p.towers[m.needsTower]?.unlocked ? `Desbloquea antes la torre ${TOWERS[m.needsTower].name}` : null;
    return h(
      `div.mission.panel${isDone ? '.done' : ''}${open ? '' : '.locked'}`,
      h(
        'div.mission-head',
        h('span.region-dot', { style: `background:${THEMES[m.biome].grassDark}` }),
        h(
          'div',
          h('h3', m.mastery ? `${m.mastery.step}. ${m.name}` : m.name),
          h('span.muted.tiny', `${BIOME_BY_ID[m.biome].name} · ${DIFFICULTY[m.difficulty].name}`),
        ),
        isDone ? h('span.check', icon('check', 18)) : null,
      ),
      h('p.story', m.story),
      h(
        'ul.rules',
        ruleLines(m).map((r) => h('li', r)),
      ),
      h(
        'div.allowed',
        m.towers.map((id) => h('img', { src: towerPortrait(id, 1, -1, 48), alt: TOWERS[id].name, title: TOWERS[id].name })),
      ),
      h('div.mission-foot', rewardChip(m), play),
      needs ? h('p.muted.tiny', needs) : !open && missing.length ? h('p.muted.tiny', `Antes completa: ${missing.join(', ')}`) : null,
    );
  }

  function renderStory() {
    for (let c = 0; c < CHAPTERS.length; c++) {
      const list = MISSIONS.filter((m) => m.chapter === c);
      const done = list.filter((m) => p.missions[m.id]?.done).length;
      body.append(h('div.section-title', `${CHAPTERS[c]}`, h('span.muted', ` · ${done}/${list.length}`)));
      body.append(h('div.mission-grid', list.map(missionCard)));
    }
  }

  function renderMastery() {
    body.append(
      h(
        'p.muted',
        { style: 'margin:4px 0 10px' },
        'Cuatro misiones por torre, jugadas solo con ella. Al completar la cuarta consigues su maestría: la torre luce dorada en todas tus partidas (solo estético).',
      ),
    );
    const tiles = h('div.mastery-grid');
    for (const id of MASTERY_TOWERS) {
      const def = TOWERS[id];
      const steps = MISSIONS.filter((m) => m.mastery?.tower === id);
      const done = steps.filter((m) => p.missions[m.id]?.done).length;
      const owned = !!p.towers[id]?.unlocked;
      const gold = towerMastered(p, id);
      const tile = h(
        `button.mastery-tile${view.tower === id ? '.on' : ''}${gold ? '.gold' : ''}${owned ? '' : '.locked'}`,
        h('img', { src: towerPortrait(id, 1, -1, 64), alt: '' }),
        h('span.name', def.name.replace('Torre de ', '').replace('Torre ', '')),
        h(
          'span.pips',
          [1, 2, 3, 4].map((i) => h(`span${i <= done ? '.on' : ''}`)),
        ),
        gold ? h('span.crown', icon('crown', 14)) : null,
      );
      tile.onclick = () => {
        app.sfx('click');
        view.tower = view.tower === id ? null : id;
        render();
      };
      tiles.append(tile);
    }
    body.append(tiles);
    if (view.tower) {
      const def = TOWERS[view.tower];
      body.append(h('div.section-title', { style: 'margin-top:14px' }, `Maestría: ${def.name}`));
      body.append(h('div.mission-grid', MISSIONS.filter((m) => m.mastery?.tower === view.tower).map(missionCard)));
    }
  }

  const tabs = h('div.seg', { style: 'margin-bottom:6px' });
  function render() {
    tabs.replaceChildren(
      ...(
        [
          [
            'story',
            'Campaña de misiones',
            `${MISSIONS.filter((m) => m.chapter >= 0 && p.missions[m.id]?.done).length}/${MISSIONS.filter((m) => m.chapter >= 0).length}`,
          ],
          ['mastery', 'Maestrías', `${MASTERY_TOWERS.filter((id) => towerMastered(p, id)).length}/${MASTERY_TOWERS.length} doradas`],
        ] as const
      ).map(([id, label, sub]) => {
        const b = h('button', label, h('small', sub));
        b.classList.toggle('on', view.tab === id);
        b.onclick = () => {
          app.sfx('click');
          view.tab = id;
          render();
        };
        return b;
      }),
    );
    body.replaceChildren();
    if (view.tab === 'story') renderStory();
    else renderMastery();
  }
  render();

  const story = MISSIONS.filter((m) => m.chapter >= 0);
  const total = story.filter((m) => p.missions[m.id]?.done).length;
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
        h('h2', 'Misiones'),
        h('span.star-badge', icon('medal', 16), `${total}/${story.length}`),
      ),
      h(
        'div.window-body',
        h(
          'p.muted',
          { style: 'margin:0 0 8px' },
          'Batallas con reglas especiales. Algunas recompensas solo se consiguen aquí: torres, regiones y maestrías.',
        ),
        tabs,
        body,
      ),
    ),
  );
  return { el };
}

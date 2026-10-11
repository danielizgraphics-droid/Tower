import { BIOME_BY_ID } from '../../data/biomes';
import { DIFFICULTY } from '../../data/maps';
import { CHAPTERS, MISSIONS, MISSION_BY_ID, ruleLines, type MissionDef } from '../../data/missions';
import { TOWERS } from '../../data/towers';
import { missionAvailable } from '../../meta/profile';
import { towerPortrait } from '../../render/portraits';
import { THEMES } from '../../render/theme';
import type { App, Screen } from '../app';
import { h } from '../dom';
import { icon } from '../icons';

/** Missions that can be played now and haven't been completed (for the menu badge). */
export function pendingMissions(app: App): number {
  const p = app.profile;
  return MISSIONS.filter((m) => !p.missions[m.id]?.done && missionAvailable(p, m)).length;
}

function rewardChip(m: MissionDef): HTMLElement {
  const r = m.reward;
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

export function missionsScreen(app: App): Screen {
  const p = app.profile;
  const body = h('div.missions');

  for (let c = 0; c < CHAPTERS.length; c++) {
    const list = MISSIONS.filter((m) => m.chapter === c);
    const done = list.filter((m) => p.missions[m.id]?.done).length;
    body.append(h('div.section-title', `${CHAPTERS[c]}`, h('span.muted', ` · ${done}/${list.length}`)));
    body.append(
      h(
        'div.mission-grid',
        list.map((m) => {
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
          const card = h(
            `div.mission.panel${isDone ? '.done' : ''}${open ? '' : '.locked'}`,
            h(
              'div.mission-head',
              h('span.region-dot', { style: `background:${THEMES[m.biome].grassDark}` }),
              h('div', h('h3', m.name), h('span.muted.tiny', `${BIOME_BY_ID[m.biome].name} · ${DIFFICULTY[m.difficulty].name}`)),
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
            !open && missing.length ? h('p.muted.tiny', `Antes completa: ${missing.join(', ')}`) : null,
          );
          return card;
        }),
      ),
    );
  }

  const total = MISSIONS.filter((m) => p.missions[m.id]?.done).length;
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
        h('span.star-badge', icon('medal', 16), `${total}/${MISSIONS.length}`),
      ),
      h(
        'div.window-body',
        h(
          'p.muted',
          { style: 'margin:0 0 4px' },
          'Batallas con reglas especiales. Algunas recompensas solo se consiguen aquí: torres y regiones exclusivas.',
        ),
        body,
      ),
    ),
  );
  return { el };
}

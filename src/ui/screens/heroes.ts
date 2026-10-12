import { DAMAGE_TYPES } from '../../data/damage';
import { HERO_LEVEL_KILLS } from '../../data/heroes';
import { HERO_LIST } from '../../data/towers';
import { heroProgress } from '../../meta/profile';
import { towerPortrait } from '../../render/portraits';
import type { App, Screen } from '../app';
import { h } from '../dom';
import { icon } from '../icons';

/** Heroes the player has unlocked but never picked yet (menu badge). */
export function newHeroes(app: App): number {
  const p = app.profile;
  return p.hero ? 0 : HERO_LIST.filter((d) => heroProgress(p, d.id).done).length;
}

/** Hero towers: what each does, how to unlock it, and which one to bring to battle. */
export function heroesScreen(app: App): Screen {
  const p = app.profile;
  const grid = h('div.heroes');

  function render() {
    grid.replaceChildren(
      ...HERO_LIST.map((def) => {
        const info = def.hero!;
        const prog = heroProgress(p, def.id);
        const chosen = p.hero === def.id && prog.done;
        const pick = h(
          `button.btn.${chosen ? 'green' : 'primary'}`,
          { disabled: !prog.done },
          icon(prog.done ? (chosen ? 'check' : 'crown') : 'lock', 18),
          prog.done ? (chosen ? 'Elegida' : 'Elegir') : 'Bloqueada',
        );
        pick.onclick = () => {
          app.sfx('click');
          p.hero = chosen ? null : def.id;
          app.save();
          render();
        };
        const dmg = DAMAGE_TYPES[def.damageType];
        return h(
          `div.hero.panel${chosen ? '.on' : ''}${prog.done ? '' : '.locked'}`,
          h(
            'div.hero-head',
            h('img', { src: towerPortrait(def.id, 1, -1, 96), alt: '' }),
            h(
              'div',
              h('h3', def.name),
              h('span.muted.tiny', info.title),
              h(
                'div',
                { style: 'margin-top:4px;display:flex;gap:6px;align-items:center;flex-wrap:wrap' },
                h('span.tag', { style: `background:${dmg.color};color:#2f2748` }, dmg.name),
                h('span.muted.tiny', `${def.targetsAir ? 'Tierra y aire' : 'Solo tierra'}${def.placement === 'water' ? ' · sobre el agua' : ''}`),
              ),
            ),
          ),
          h('p.story', def.description),
          h(
            'ul.rules',
            info.milestones.map((m) => h('li', `Nv. ${m.level}: ${m.text}`)),
          ),
          prog.done ? null : h('div.hero-unlock', icon('lock', 14), h('span', prog.text, prog.progress ? h('b', ` ${prog.progress}`) : null)),
          h('div.mission-foot', h('span.muted.tiny', `${def.cost} de oro · una por partida`), pick),
        );
      }),
    );
  }
  render();

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
        h('h2', 'Héroes'),
        h('span.star-badge', icon('crown', 16), `${HERO_LIST.filter((d) => heroProgress(p, d.id).done).length}/${HERO_LIST.length}`),
      ),
      h(
        'div.window-body',
        h(
          'p.muted',
          { style: 'margin:0 0 10px' },
          `Elige la torre heroica que llevas a tus batallas. Solo puedes poner una por partida (no en misiones). No se mejora con oro: sube de nivel (hasta ${HERO_LEVEL_KILLS.length}) con cada enemigo que abate, y empieza de cero en cada partida.`,
        ),
        grid,
      ),
    ),
  );
  return { el };
}

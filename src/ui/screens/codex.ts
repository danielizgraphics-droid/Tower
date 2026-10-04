import { DAMAGE_TYPES } from '../../data/damage';
import { ENEMY_LIST } from '../../data/enemies';
import { SPELL_LIST } from '../../data/spells';
import { TOWER_LIST } from '../../data/towers';
import type { DamageType, EnemyDef } from '../../data/types';
import { effectiveAttack, effectiveDamageType } from '../../game/modifiers';
import { enemyPortrait, towerPortrait } from '../../render/portraits';
import type { App, Screen } from '../app';
import { h } from '../dom';
import { ATTACK_LABELS } from '../format';
import { icon } from '../icons';

function traits(e: EnemyDef): string[] {
  const t: string[] = [];
  if (e.flying) t.push('Volador');
  if (e.boss) t.push('Jefe');
  if (e.undead) t.push('No-muerto');
  if (e.regen) t.push('Regenera');
  if (e.shieldRegen) t.push('Escudo regenerable');
  if (e.heal) t.push('Sanador');
  if (e.split) t.push('Se divide');
  if (e.summon) t.push('Invocador');
  if (e.ccResist) t.push(`Resiste control ${Math.round(e.ccResist * 100)}%`);
  for (const [k, v] of Object.entries(e.resist ?? {})) t.push(`${DAMAGE_TYPES[k as DamageType].name} ×${v}`);
  return t;
}

const typeTag = (t: DamageType) => h('span.tag', { style: `background:${DAMAGE_TYPES[t].color};color:#2f2748` }, DAMAGE_TYPES[t].name);

export function codexScreen(app: App): Screen {
  let tab: 'enemies' | 'towers' | 'damage' = 'enemies';
  const body = h('div.window-body');
  const tabs = h('div.tabs');
  const seen = new Set(app.profile.seenEnemies);

  function renderTabs() {
    const mk = (id: typeof tab, label: string, ic: string) => {
      const b = h('button.tab', { style: 'padding:8px 12px' }, icon(ic, 18), label);
      b.classList.toggle('on', id === tab);
      b.onclick = () => {
        app.sfx('click');
        tab = id;
        render();
      };
      return b;
    };
    tabs.replaceChildren(mk('enemies', 'Bestiario', 'skull'), mk('towers', 'Torres', 'tower'), mk('damage', 'Daño y hechizos', 'burst'));
  }

  function render() {
    renderTabs();
    if (tab === 'enemies') {
      body.replaceChildren(
        h(
          'div.layer-legend',
          h('span', h('i', { style: 'background:#58b7ff' }), 'Escudo (se pierde primero)'),
          h('span', h('i', { style: 'background:#c3c8d4' }), 'Armadura'),
          h('span', h('i', { style: 'background:#e5484d' }), 'Vida'),
        ),
        h(
          'div.codex-grid',
          ENEMY_LIST.filter((e) => e.id !== 'slimeling').map((e) => {
            const known = seen.has(e.id) || (app.profile.stats.runs > 0 && e.minWave <= 3);
            const card = h(
              'div.codex-card',
              h('img', { src: enemyPortrait(e.id, 64), alt: '' }),
              h(
                'div',
                h('h4', known ? e.name : '???'),
                h('p', known ? e.description : 'Aún no te has enfrentado a esta criatura.'),
                known
                  ? h(
                      'div',
                      { style: 'display:flex;gap:4px;flex-wrap:wrap;font-size:11px;font-weight:800' },
                      h('span.pill', `Vida ${e.hp}`),
                      e.armor ? h('span.pill', `Armadura ${e.armor}`) : null,
                      e.shield ? h('span.pill', `Escudo ${e.shield}`) : null,
                      h('span.pill', `Vel. ${e.speed}`),
                      ...traits(e).map((t) => h('span.pill', { style: 'background:rgba(122,92,214,.12);color:#4b3596' }, t)),
                    )
                  : null,
              ),
            );
            if (!known) card.classList.add('unknown');
            return card;
          }),
        ),
      );
    } else if (tab === 'towers') {
      body.replaceChildren(
        h(
          'div',
          { style: 'display:flex;flex-direction:column;gap:12px' },
          TOWER_LIST.map((t) =>
            h(
              'div.codex-card',
              { style: 'flex-wrap:wrap' },
              h('img', { src: towerPortrait(t.id, 3, -1, 72), style: 'width:72px;height:72px' }),
              h(
                'div',
                { style: 'flex:1;min-width:200px' },
                h('h4', t.name, ' ', typeTag(t.damageType)),
                h('p', t.description),
                h('span.muted.tiny', `${t.role} · ${ATTACK_LABELS[t.attack]} · ${t.targetsAir ? 'Tierra y aire' : 'Solo tierra'} · ${t.cost} de oro`),
              ),
              h(
                'div',
                { style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;width:100%' },
                t.branches.map((b, i) =>
                  h(
                    'div',
                    { style: 'display:flex;gap:8px;align-items:flex-start;background:#faf4e4;border-radius:10px;padding:6px' },
                    h('img', { src: towerPortrait(t.id, 5, i, 48), style: 'width:48px;height:48px' }),
                    h(
                      'div',
                      h('b', { style: 'font-size:13px' }, b.name),
                      ' ',
                      effectiveDamageType(t, i) !== t.damageType ? typeTag(effectiveDamageType(t, i)) : null,
                      h('div.muted.tiny', b.description),
                      h('div.tiny', { style: 'color:#7a5cd6;font-weight:800' }, ATTACK_LABELS[effectiveAttack(t, i)]),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      );
    } else {
      body.replaceChildren(
        h('div.section-title', 'Eficacia por tipo de daño'),
        h(
          'p.muted',
          { style: 'margin-top:0' },
          'Cada enemigo tiene hasta tres capas. El daño se aplica primero al escudo, después a la armadura y por último a la vida. Combina tipos de daño para acabar con todas.',
        ),
        h(
          'table.dmg',
          h('tr', h('th', 'Tipo'), h('th', 'Escudo'), h('th', 'Armadura'), h('th', 'Vida'), h('th', '')),
          (Object.keys(DAMAGE_TYPES) as DamageType[]).map((k) => {
            const d = DAMAGE_TYPES[k];
            const cell = (v: number) => h(`td${v > 1.05 ? '.good' : v < 0.95 ? '.bad' : ''}`, `×${v}`);
            return h(
              'tr',
              h('td', typeTag(k)),
              cell(d.vs[0]),
              cell(d.vs[1]),
              cell(d.vs[2]),
              h('td.muted.tiny', { style: 'text-align:left' }, d.hint),
            );
          }),
        ),
        h('div.section-title', 'Hechizos'),
        h(
          'div.codex-grid',
          SPELL_LIST.map((s) =>
            h(
              'div.codex-card',
              h(
                'div',
                { class: `spell ${s.id}`, style: 'position:relative;width:56px;height:56px;flex:none' },
                icon(s.id === 'meteor' ? 'flame' : s.id === 'frostNova' ? 'snow' : 'sparkle', 26),
              ),
              h(
                'div',
                h('h4', s.name),
                h('p', s.description),
                h('span.muted.tiny', `${s.mana} de maná · ${s.cooldown}s de recarga${s.unlockedByDefault ? '' : ' · se desbloquea con talentos'}`),
              ),
            ),
          ),
        ),
      );
    }
  }
  render();
  const el = h(
    'div.screen.dim',
    h(
      'div.window.panel',
      { style: 'height:min(820px,100%)' },
      h(
        'div.window-head',
        h(
          'button.btn.small.icon-only.ghost',
          { onclick: () => (app.sfx('click'), app.go({ name: 'menu' })), 'aria-label': 'Volver' },
          icon('undo', 18),
        ),
        h('h2', 'Códice'),
      ),
      tabs,
      body,
    ),
  );
  return { el };
}

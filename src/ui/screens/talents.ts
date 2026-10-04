import { TOWERS, TOWER_LIST } from '../../data/towers';
import type { TowerId } from '../../data/types';
import { buyNode, currencyAvailable, nodeState, resetTree, spentPoints, towerLevel, treeRanks, unlockTower } from '../../meta/profile';
import { GENERAL_TREE, MAX_TOWER_LEVEL, TOWER_LEVEL_XP, TOWER_TREES, type TalentNode, type TalentTree } from '../../meta/talentTrees';
import { towerPortrait } from '../../render/portraits';
import type { App, Route, Screen } from '../app';
import { h } from '../dom';
import { icon } from '../icons';
import { tip } from '../tooltip';

const ROMAN = ['I', 'II', 'III'];

export function talentsScreen(app: App, route: Route): Screen {
  const p = app.profile;
  let tab = (route.name === 'talents' && route.tab) || 'general';
  let selectedNode: string | null = null;

  const tabsEl = h('div.tabs');
  const body = h('div.window-body');
  const starBadge = h('span.star-badge');

  const treeOf = (t: string): TalentTree => (t === 'general' ? GENERAL_TREE : TOWER_TREES[t as TowerId]);

  function hasWork(t: string): boolean {
    const tree = treeOf(t);
    if (t !== 'general' && !p.towers[t as TowerId].unlocked) return p.stars >= TOWERS[t as TowerId].unlockCost;
    return tree.nodes.some((n) => nodeState(p, tree, n) === 'available');
  }

  function renderTabs() {
    const mk = (id: string, label: string, img: Node) => {
      const b = h('button.tab', img, h('span', label));
      b.classList.toggle('on', id === tab);
      if (id !== 'general' && !p.towers[id as TowerId].unlocked) b.classList.add('locked');
      if (hasWork(id)) b.append(h('span.dot'));
      b.onclick = () => {
        app.sfx('click');
        tab = id;
        selectedNode = null;
        render();
      };
      return b;
    };
    tabsEl.replaceChildren(
      mk(
        'general',
        'Comandante',
        h('span', { style: 'width:30px;height:30px;display:flex;align-items:center;justify-content:center;color:#7a5cd6' }, icon('crown', 24)),
      ),
      ...TOWER_LIST.map((t) =>
        mk(t.id, t.name.replace('Torre de ', '').replace('Torre ', ''), h('img', { src: towerPortrait(t.id, 1, -1, 60), alt: '' })),
      ),
    );
  }

  function nodeEl(tree: TalentTree, node: TalentNode): HTMLElement {
    const ranks = treeRanks(p, tree);
    const rank = ranks[node.id] ?? 0;
    const state = nodeState(p, tree, node);
    let content: Node;
    if (node.icon.startsWith('branch')) {
      const bi = Number(node.icon.slice(6));
      content = h('img', { src: towerPortrait(tree.id as TowerId, 5, bi, 64), alt: ROMAN[bi], style: 'width:58px;height:58px' });
    } else content = icon(node.icon, node.id.endsWith('capstone') ? 40 : 32);
    const el = h(
      'button.node',
      { style: `grid-column:${node.col + 1};grid-row:${node.row + 1}`, 'data-id': node.id },
      content,
      h('span.rank', `${rank}/${node.maxRank}`),
    );
    if (node.id.endsWith('capstone')) el.classList.add('capstone');
    if (rank > 0) el.classList.add('owned');
    if (state === 'maxed') el.classList.add('maxed');
    else if (state === 'available') el.classList.add('available');
    else if (state === 'locked') el.classList.add('locked');
    if (selectedNode === node.id) el.style.outline = '3px solid #7a5cd6';
    tip(el, () => nodeTip(tree, node));
    el.onclick = () => {
      app.sfx('click');
      if (selectedNode === node.id && state === 'available') buy(tree, node);
      else {
        selectedNode = node.id;
        render();
      }
    };
    return el;
  }

  function nodeTip(tree: TalentTree, node: TalentNode): Node {
    const rank = treeRanks(p, tree)[node.id] ?? 0;
    const cost = node.costs[rank];
    const cur = tree.currency === 'stars' ? 'estrellas' : 'puntos';
    return h(
      'div',
      h('h4', node.name),
      h('div', node.description),
      h('div.muted', { style: 'margin-top:6px' }, rank >= node.maxRank ? 'Rango máximo' : `Rango ${rank}/${node.maxRank} · coste ${cost} ${cur}`),
      node.requires.length && nodeState(p, tree, node) === 'locked'
        ? h('div.muted', node.id.endsWith('capstone') ? 'Requiere cualquier talento de rama.' : 'Requiere el talento anterior.')
        : null,
    );
  }

  function buy(tree: TalentTree, node: TalentNode) {
    if (buyNode(p, tree, node.id)) {
      app.sfx('upgrade');
      app.save();
    } else app.sfx('error');
    render();
  }

  function drawLinks(treeEl: HTMLElement, tree: TalentTree) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('links');
    const ranks = treeRanks(p, tree);
    const pos = (id: string) => {
      const el = treeEl.querySelector<HTMLElement>(`[data-id="${CSS.escape(id)}"]`);
      if (!el) return null;
      return { x: el.offsetLeft + el.offsetWidth / 2, y: el.offsetTop + el.offsetHeight / 2 };
    };
    for (const n of tree.nodes) {
      for (const r of n.requires) {
        const a = pos(r);
        const b = pos(n.id);
        if (!a || !b) continue;
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const midY = (a.y + b.y) / 2;
        line.setAttribute('d', `M${a.x},${a.y} C${a.x},${midY} ${b.x},${midY} ${b.x},${b.y}`);
        const on = (ranks[r] ?? 0) > 0;
        line.setAttribute('stroke', on ? '#e2a01e' : '#d8c59a');
        line.setAttribute('stroke-width', on ? '5' : '4');
        line.setAttribute('stroke-linecap', 'round');
        line.setAttribute('fill', 'none');
        if (!on) line.setAttribute('stroke-dasharray', '2 8');
        svg.appendChild(line);
      }
    }
    treeEl.prepend(svg);
  }

  function sidePanel(tree: TalentTree): HTMLElement {
    const side = h('div.tree-side');
    if (tree.currency === 'stars') {
      side.append(
        h(
          'div',
          { style: 'display:flex;gap:10px;align-items:center' },
          h('span', { style: 'color:#7a5cd6' }, icon('crown', 40)),
          h('div', h('h3', { style: 'font-size:22px' }, 'Comandante'), h('span.muted.tiny', 'Mejoras permanentes para todas tus partidas.')),
        ),
        h('div.star-badge', { style: 'align-self:flex-start' }, icon('star', 18), `${p.stars} estrellas disponibles`),
      );
    } else {
      const id = tree.id as TowerId;
      const def = TOWERS[id];
      const prog = p.towers[id];
      const lvl = towerLevel(p, id);
      const cur = TOWER_LEVEL_XP[lvl];
      const next = TOWER_LEVEL_XP[Math.min(MAX_TOWER_LEVEL, lvl + 1)];
      const frac = lvl >= MAX_TOWER_LEVEL ? 1 : (prog.xp - cur) / Math.max(1, next - cur);
      side.append(
        h('img.portrait', { src: towerPortrait(id, Math.min(5, 1 + Math.floor(lvl / 4)), lvl >= 12 ? 0 : -1, 120), alt: def.name }),
        h('div', h('h3', { style: 'font-size:22px' }, def.name), h('span.muted', def.description)),
      );
      if (!prog.unlocked) {
        const can = p.stars >= def.unlockCost;
        side.append(
          h(
            'div.panel',
            { style: 'padding:12px;display:flex;flex-direction:column;gap:8px' },
            h('b', 'Torre bloqueada'),
            h('span.muted.tiny', 'Desbloquéala para usarla en tus partidas y ganar experiencia con ella.'),
            h(
              'button.btn.primary',
              {
                disabled: !can,
                onclick: () => {
                  if (unlockTower(p, id)) {
                    app.sfx('upgrade');
                    app.save();
                    render();
                  }
                },
              },
              icon('lock', 18),
              `Desbloquear · ${def.unlockCost}`,
              icon('star', 16),
            ),
          ),
        );
      } else {
        side.append(
          h(
            'div',
            h(
              'div',
              { style: 'display:flex;justify-content:space-between;font-weight:800;font-size:13px' },
              h('span', `Maestría nivel ${lvl}`),
              h('span.muted', lvl >= MAX_TOWER_LEVEL ? 'MÁX' : `${Math.floor(prog.xp)}/${next} XP`),
            ),
            h('div.xpbar', h('div', { style: `width:${Math.round(frac * 100)}%` })),
            h('span.muted.tiny', 'Gana experiencia infligiendo daño con esta torre. Cada nivel otorga 1 punto de talento.'),
          ),
          h('div.star-badge', { style: 'align-self:flex-start' }, icon('sparkle', 18), `${currencyAvailable(p, tree)} puntos disponibles`),
        );
      }
      side.append(
        h(
          'div',
          { style: 'display:flex;flex-direction:column;gap:6px' },
          h('b.tiny', 'Especializaciones'),
          def.branches.map((b, i) =>
            h(
              'div',
              { style: 'display:flex;gap:8px;align-items:center' },
              h('img', { src: towerPortrait(id, 5, i, 40), style: 'width:40px;height:40px' }),
              h('div', h('b', { style: 'font-size:13px' }, b.name), h('div.muted.tiny', b.description)),
            ),
          ),
        ),
      );
    }
    // Selected node details
    const node = tree.nodes.find((n) => n.id === selectedNode);
    if (node) {
      const rank = treeRanks(p, tree)[node.id] ?? 0;
      const state = nodeState(p, tree, node);
      const cost = node.costs[rank];
      side.append(
        h(
          'div.panel',
          { style: 'padding:12px;display:flex;flex-direction:column;gap:6px' },
          h('b', { style: 'font-family:var(--font-head);font-size:17px' }, node.name),
          h('span', { style: 'font-size:14px' }, node.description),
          h('span.muted.tiny', `Rango ${rank}/${node.maxRank}`),
          state === 'maxed'
            ? h('span.pill', icon('check', 14), 'Completado')
            : h(
                'button.btn.purple',
                { disabled: state !== 'available', onclick: () => buy(tree, node) },
                state === 'locked' ? icon('lock', 18) : icon('plus', 18),
                state === 'locked' ? 'Bloqueado' : `Aprender · ${cost} ${tree.currency === 'stars' ? '★' : 'pts'}`,
              ),
        ),
      );
    } else {
      side.append(h('span.muted.tiny', 'Pulsa un talento para ver los detalles. Púlsalo de nuevo para aprenderlo.'));
    }
    const spent = spentPoints(tree, treeRanks(p, tree));
    if (spent > 0) {
      side.append(
        h(
          'button.btn.small.ghost',
          {
            onclick: () => {
              resetTree(p, tree);
              app.sfx('sell');
              app.save();
              selectedNode = null;
              render();
            },
          },
          icon('refresh', 16),
          tree.currency === 'stars' ? `Reiniciar (+${spent} ★)` : 'Reiniciar puntos',
        ),
      );
    }
    return side;
  }

  function render() {
    renderTabs();
    starBadge.replaceChildren(icon('star', 16), String(p.stars));
    const tree = treeOf(tab);
    const cell = innerWidth < 760 || innerHeight < 520 ? 70 : 92;
    const treeEl = h('div.tree', {
      style: `grid-template-columns:repeat(${tree.cols}, ${cell}px);grid-template-rows:repeat(${tree.rows}, ${cell}px)`,
    });
    for (const n of tree.nodes) treeEl.append(nodeEl(tree, n));
    const heads = tree.columns
      ? h(
          'div.tree-heads',
          { style: `grid-template-columns:repeat(${tree.cols}, ${cell}px)` },
          tree.columns.map((c) => h('span', c)),
        )
      : null;
    body.replaceChildren(h('div.tree-layout', sidePanel(tree), h('div', { style: 'overflow:auto' }, heads, treeEl)));
    requestAnimationFrame(() => drawLinks(treeEl, tree));
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
          'button.btn.small.icon-only.wood',
          { onclick: () => (app.sfx('click'), app.go({ name: 'menu' })), 'aria-label': 'Volver' },
          icon('undo', 18),
        ),
        h('h2', 'Talentos'),
        starBadge,
      ),
      tabsEl,
      body,
    ),
  );
  return {
    el,
    resize: () => {
      const t = el.querySelector<HTMLElement>('.tree');
      if (t) {
        t.querySelector('svg.links')?.remove();
        drawLinks(t, treeOf(tab));
      }
    },
  };
}

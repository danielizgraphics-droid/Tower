import { RARITY_INFO } from '../../data/augments';
import { DAMAGE_TYPES } from '../../data/damage';
import { ENEMIES } from '../../data/enemies';
import { BIOMES } from '../../data/biomes';
import { DIFFICULTY } from '../../data/maps';
import { generateMap, seedCode } from '../../game/mapgen';
import { SPELLS, SPELL_LIST } from '../../data/spells';
import { BRANCH_TIER, MAX_TIER, TOWERS, TOWER_LIST } from '../../data/towers';
import type { AugmentDef, Difficulty, SpellId, TargetMode, TowerId } from '../../data/types';
import type { SfxName } from '../../engine/audio';
import { formatNumber } from '../../engine/math';
import type { Tower } from '../../game/entities';
import { Game } from '../../game/game';
import { effectiveAttack, effectiveDamageType, effectiveTargetsAir } from '../../game/modifiers';
import { wavePreview } from '../../game/waves';
import { applyRunResult, isMapUnlocked, profileModifiers, type RewardSummary } from '../../meta/profile';
import { enemyPortrait, towerPortrait } from '../../render/portraits';
import { Renderer } from '../../render/renderer';
import { GRASS_H } from '../../render/terrain';
import type { App, Route, Screen } from '../app';
import { h, setText, toggleClass } from '../dom';
import { statLines, TARGET_LABELS } from '../format';
import { icon } from '../icons';
import { hideTip, tip } from '../tooltip';
import { openSettings } from './settings';

const SPELL_ICON: Record<SpellId, string> = { meteor: 'flame', frostNova: 'snow', blessing: 'sparkle' };
const SPELL_KEYS: Record<SpellId, string> = { meteor: 'Q', frostNova: 'W', blessing: 'E' };

export function gameScreen(app: App, route: Route): Screen {
  if (route.name !== 'game') throw new Error('bad route');
  const run = route;
  const endless = run.endless;
  const mapDef = generateMap({ biome: run.biome, seed: run.seed, waves: endless ? Infinity : 30 });
  const difficulty: Difficulty = route.difficulty;
  const profile = app.profile;
  const unlocked = TOWER_LIST.filter((t) => profile.towers[t.id].unlocked).map((t) => t.id);

  const game = new Game({ map: mapDef, difficulty, mods: profileModifiers(profile), unlockedTowers: unlocked });
  const canvas = h('canvas.stage');
  const renderer = new Renderer(canvas, game);
  renderer.view.showDamage = profile.settings.showDamageNumbers;
  renderer.view.shakeEnabled = profile.settings.screenShake;

  // ------------------------------------------------------------ state
  let buildId: TowerId | null = null;
  /** Tile the placement ghost sits on while choosing where to build. */
  let placing: { x: number; y: number } | null = null;
  /** A tower being carried by finger or mouse, either from its card or the ghost on the map. */
  let drag: {
    pointerId: number;
    from: 'card' | 'map';
    id: TowerId;
    sx: number;
    sy: number;
    ox: number;
    oy: number;
    active: boolean;
    type: string;
  } | null = null;
  let lastPointer = 'mouse';
  /** Touch: carry the tower this far above the finger so it stays visible. */
  const LIFT = 72;
  let spellId: SpellId | null = null;
  let selected: Tower | null = null;
  let finished = false;
  let autoWave = false;
  let tutorialStep = profile.tutorialDone ? -1 : 0;
  let panelSig = '';
  let panelTimer = 0;
  let lastGold = -1;
  let lastLives = game.lives;

  // ------------------------------------------------------------ HUD elements
  const livesVal = h('div.val');
  const livesBar = h('div');
  const goldVal = h('div.val');
  const manaVal = h('div.val');
  const manaBar = h('div');
  const waveVal = h('div.val');
  const waveBtn = h('button.btn.small.primary', icon('play', 16), h('span.label', 'Iniciar oleada'));
  const autoBtn = h('button.btn.small.icon-only.wood', { title: 'Oleadas automáticas', 'aria-label': 'Oleadas automáticas' }, icon('refresh', 16));
  const livesStat = h('div.stat.lives', h('div.badge', icon('heart', 18)), h('div', livesVal, h('div.bar', livesBar)));
  const goldStat = h('div.stat.gold', h('div.badge', icon('coin', 18)), h('div', goldVal, h('div.sub', 'Oro')));
  const manaStat = h('div.stat.mana', h('div.badge', icon('drop', 18)), h('div', manaVal, h('div.bar', manaBar)));
  const waveStat = h(
    'div.stat.wave.wave-box',
    h('div', { style: 'display:flex;align-items:center;gap:8px' }, h('div.badge', icon('wave', 18)), h('div', waveVal, h('div.sub', 'Oleada'))),
    waveBtn,
    autoBtn,
  );
  const topBar = h('div.top-bar.plank', livesStat, waveStat, goldStat, manaStat);
  const preview = h('div.next-preview.plank');

  const pauseBtn = h('button.btn.icon-only.wood', { 'aria-label': 'Pausa' }, icon('pause', 20));
  const speedLabel = h('span', '×1');
  const speedBtn = h('button.btn.icon-only.wood.speed-btn', { 'aria-label': 'Velocidad', title: 'Velocidad (F)' }, icon('fast', 16), speedLabel);
  const cornerLeft = h('div.corner-left', pauseBtn, speedBtn);
  const augsEl = h('div.augs');
  const cornerRight = h('div.corner-right', augsEl);

  const buildBar = h('div.build-bar.plank');
  const cards = new Map<TowerId, HTMLElement>();
  const costEls = new Map<TowerId, HTMLElement>();
  TOWER_LIST.forEach((t, i) => {
    const costEl = h('span.cost', icon('coin', 12), String(t.cost));
    const card = h(
      'button.tcard',
      { 'aria-label': t.name },
      h('span.key', String((i + 1) % 10)),
      h('img', { src: towerPortrait(t.id, 1, -1, 64), alt: '', draggable: false }),
      h('span.name', t.name.replace('Torre de ', '').replace('Torre ', '')),
      costEl,
    );
    if (!unlocked.includes(t.id)) card.classList.add('locked');
    // Pointer: tap to pick (then drag the ghost on the map) or pull the card up onto the map and drop it.
    card.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || finished || !unlocked.includes(t.id)) return;
      lastPointer = e.pointerType;
      drag = {
        pointerId: e.pointerId,
        from: 'card',
        id: t.id,
        sx: e.clientX,
        sy: e.clientY,
        ox: 0,
        oy: e.pointerType === 'mouse' ? 0 : -LIFT,
        active: false,
        type: e.pointerType,
      };
    });
    // Once the tower is lifted, stop the bar from scrolling under the finger.
    card.addEventListener('touchmove', (e) => drag?.active && e.preventDefault(), { passive: false });
    // Keyboard activation (Enter / Space on a focused card).
    card.onclick = (e) => {
      if (e.detail === 0) selectBuild(buildId === t.id ? null : t.id);
    };
    tip(card, () =>
      h(
        'div',
        h('h4', t.name),
        h('div', t.description),
        h(
          'div.muted',
          { style: 'margin-top:4px' },
          `${DAMAGE_TYPES[t.damageType].name} · ${t.targetsAir ? 'tierra y aire' : 'solo tierra'} · ${t.role}`,
        ),
      ),
    );
    cards.set(t.id, card);
    costEls.set(t.id, costEl);
    buildBar.append(card);
  });

  const spellsEl = h('div.spells');
  const spellBtns = new Map<SpellId, HTMLElement>();
  for (const s of SPELL_LIST) {
    if (!game.unlockedSpells.has(s.id)) continue;
    const btn = h(
      `button.spell.${s.id}`,
      { 'aria-label': s.name },
      h('div.cd'),
      icon(SPELL_ICON[s.id], 26),
      h('span.key', SPELL_KEYS[s.id]),
      h('span.mana-cost', String(s.mana)),
    );
    btn.onclick = () => toggleSpell(s.id);
    tip(btn, () =>
      h(
        'div',
        h('h4', s.name),
        h('div', s.description),
        h('div.muted', { style: 'margin-top:4px' }, `${s.mana} de maná · ${s.cooldown}s de recarga`),
      ),
    );
    spellBtns.set(s.id, btn);
    spellsEl.append(btn);
  }

  const panel = h('div.tower-panel.panel');
  panel.style.display = 'none';
  const rotateHint = h('div.rotate-hint', icon('refresh', 16), 'Gira el dispositivo para ver mejor el campo de batalla');
  setTimeout(() => rotateHint.classList.add('fade'), 6000);
  const confirmOk = h('button.pc-btn.ok', { 'aria-label': 'Construir aquí', title: 'Construir aquí' }, icon('check', 24));
  const confirmNo = h('button.pc-btn.no', { 'aria-label': 'Cancelar', title: 'Cancelar' }, icon('close', 18));
  const confirmCost = h('span.pc-cost');
  const confirmEl = h('div.place-confirm', confirmNo, confirmCost, confirmOk);
  confirmEl.style.display = 'none';
  const hud = h('div.hud', topBar, preview, cornerLeft, cornerRight, buildBar, spellsEl, panel, rotateHint, confirmEl);
  const el = h('div', { style: 'position:absolute;inset:0' }, canvas, hud);

  // ------------------------------------------------------------ helpers
  const sfx = (n: SfxName) => app.sfx(n);

  function banner(big: string, small = '', boss = false) {
    const b = h(`div.banner${boss ? '.boss' : ''}`, h('div.big', big), small ? h('div.small', small) : null);
    hud.append(b);
    setTimeout(() => b.remove(), 2300);
  }

  function toast(text: string) {
    hud.querySelectorAll('.toast').forEach((t) => t.remove());
    const t = h('div.toast', text);
    hud.append(t);
    setTimeout(() => t.remove(), 1900);
  }

  let hintEl: HTMLElement | null = null;
  function hint(text: string | null) {
    hintEl?.remove();
    hintEl = null;
    if (!text) return;
    hintEl = h('div.hint.panel', icon('info', 20), h('span', text));
    hud.append(hintEl);
  }

  function selectBuild(id: TowerId | null) {
    if (id && !unlocked.includes(id)) return;
    sfx('click');
    buildId = id;
    spellId = null;
    renderer.view.spell = null;
    renderer.view.grid = !!id;
    if (id) select(null);
    else drag = null;
    setGhost(id ? placing : null);
    for (const [tid, c] of cards) toggleClass(c, 'on', tid === id);
    for (const [, b] of spellBtns) toggleClass(b, 'on', false);
  }

  function toggleSpell(id: SpellId) {
    if (!game.spellReady(id)) {
      sfx('error');
      toast(game.mana < SPELLS[id].mana ? 'Maná insuficiente' : 'Hechizo en recarga');
      return;
    }
    if (!SPELLS[id].targeted) {
      game.castSpell(id);
      return;
    }
    sfx('click');
    spellId = spellId === id ? null : id;
    if (spellId) {
      selectBuild(null);
      spellId = id;
    }
    renderer.view.spell = null;
    for (const [sid, b] of spellBtns) toggleClass(b, 'on', sid === spellId);
  }

  function select(t: Tower | null) {
    selected = t;
    renderer.view.selected = t;
    panelSig = '';
    if (!t) {
      panel.style.display = 'none';
      return;
    }
    panel.style.display = '';
    renderPanel(true);
  }

  // ------------------------------------------------------------ tower panel
  function renderPanel(force = false) {
    const t = selected;
    if (!t) return;
    const nextCost = t.tier >= MAX_TIER ? null : t.tier === BRANCH_TIER ? null : game.upgradeCost(t);
    const branchCosts = t.tier === BRANCH_TIER ? [0, 1, 2].map((b) => game.upgradeCost(t, b) ?? 0) : [];
    const afford = [nextCost, ...branchCosts].map((c) => (c !== null && game.gold >= c ? 1 : 0)).join('');
    const sig = `${t.uid}:${t.tier}:${t.branch}:${t.targetMode}:${afford}:${t.kills}:${game.sellValue(t)}:${Math.round(t.damageDealt / 50)}`;
    if (!force && sig === panelSig) return;
    panelSig = sig;
    const def = t.def;
    const kind = effectiveAttack(def, t.branch);
    const branch = t.branch >= 0 ? def.branches[t.branch] : null;
    const stats = game.liveStats(t);
    const dmgType = effectiveDamageType(def, t.branch);
    let nextStats = undefined;
    let nextKind = undefined;
    if (t.tier < BRANCH_TIER || (t.tier > BRANCH_TIER && t.tier < MAX_TIER)) {
      nextStats = game.previewStats(def.id, t.tier + 1, t.branch);
      nextKind = kind;
    }
    const lines = statLines(stats, kind, nextStats, nextKind);
    const tierDots = h(
      'div.tier-dots',
      [1, 2, 3, 4, 5].map((i) => h(`span${i <= t.tier ? '.on' : ''}${i > BRANCH_TIER ? '.br' : ''}`)),
    );
    const modes: TargetMode[] = ['first', 'last', 'strong', 'close'];
    const targeting =
      kind === 'pulse' || kind === 'aura'
        ? null
        : h(
            'div.targeting',
            modes.map((m) => {
              const b = h('button', TARGET_LABELS[m]);
              toggleClass(b, 'on', t.targetMode === m);
              b.onclick = () => {
                sfx('click');
                game.setTargetMode(t, m);
                renderPanel(true);
              };
              return b;
            }),
          );

    let upgrade: HTMLElement;
    if (t.tier >= MAX_TIER) {
      upgrade = h('div.pill', { style: 'justify-content:center;width:100%;padding:8px' }, icon('crown', 16), 'Nivel máximo');
    } else if (t.tier === BRANCH_TIER) {
      upgrade = h(
        'div.branches',
        h('b.tiny', 'Elige una especialización'),
        def.branches.map((b, i) => {
          const cost = branchCosts[i];
          const btn = h(
            'button.branch',
            { disabled: game.gold < cost },
            h('img', { src: towerPortrait(def.id, 4, i, 64), alt: '' }),
            h(
              'div',
              h('h4', b.name),
              h('p', b.description),
              h('span', { class: `cost${game.gold < cost ? ' bad' : ''}` }, icon('coin', 12), String(cost)),
            ),
          );
          btn.onclick = () => doUpgrade(i);
          return btn;
        }),
      );
    } else {
      const label = t.tier < BRANCH_TIER ? `Mejorar a nivel ${t.tier + 1}` : `Maestría: ${branch?.name}`;
      upgrade = h(
        'button.btn.green',
        { style: 'width:100%', disabled: nextCost === null || game.gold < nextCost, onclick: () => doUpgrade() },
        icon('up', 18),
        label,
        h('span.cost', { style: 'color:#fff' }, icon('coin', 14), String(nextCost)),
      );
      upgrade.title = 'Atajo: U';
    }
    const targets = `${def.targetsGround ? 'Tierra' : ''}${def.targetsGround && effectiveTargetsAir(def, t.branch) ? ' y aire' : effectiveTargetsAir(def, t.branch) ? 'Aire' : ''}`;
    const parts = [
      h(
        'div.tp-head',
        h('img', { src: towerPortrait(def.id, t.tier, t.branch, 64), alt: '' }),
        h(
          'div',
          { style: 'flex:1' },
          h('h3', branch ? branch.name : def.name),
          h(
            'div',
            { style: 'margin-top:3px' },
            h('span.tag', { style: `background:${DAMAGE_TYPES[dmgType].color};color:#2f2748` }, DAMAGE_TYPES[dmgType].name),
            h('span.muted.tiny', targets),
          ),
          tierDots,
        ),
        h('button.btn.small.icon-only.wood', { onclick: () => select(null), 'aria-label': 'Cerrar' }, icon('close', 16)),
      ),
      h(
        'div.stats',
        lines.map((l) => h('div.row', h('span.muted', l.label), h('span', h('b', l.value), l.delta ? h('span.delta', l.delta) : null))),
      ),
      targeting,
      upgrade,
      h(
        'div.tp-actions',
        h(
          'button.btn.small.red',
          { onclick: () => doSell(), title: 'Atajo: S' },
          icon('trash', 16),
          'Vender',
          h('span.cost', { style: 'color:#fff' }, icon('coin', 12), String(game.sellValue(t))),
        ),
      ),
      h('div.muted.tiny', { style: 'margin-top:8px;text-align:center' }, `${t.kills} bajas · ${formatNumber(t.damageDealt)} de daño`),
    ].filter((x): x is HTMLElement => !!x);
    panel.replaceChildren(parts[0], h('div.tp-body', parts.slice(1)));
  }

  function doUpgrade(branch?: number) {
    const t = selected;
    if (!t) return;
    if (t.tier === BRANCH_TIER && branch === undefined) {
      toast('Elige una especialización');
      return;
    }
    if (game.upgrade(t, branch)) {
      if (t.tier === BRANCH_TIER + 1) banner(t.def.branches[t.branch].name, 'Especialización desbloqueada');
      renderPanel(true);
      if (tutorialStep === 2) {
        tutorialStep = 3;
        hint(null);
      }
    } else {
      sfx('error');
      toast('Oro insuficiente');
    }
  }

  function doSell() {
    const t = selected;
    if (!t) return;
    game.sell(t);
    select(null);
  }

  // ------------------------------------------------------------ input
  const pointers = new Map<number, { x: number; y: number; sx: number; sy: number; moved: boolean; type: string }>();
  let pinchDist = 0;
  let pinchZoom = 1;
  let pinchMid = { x: 0, y: 0 };

  function setGhost(tile: { x: number; y: number } | null) {
    placing = buildId ? tile : null;
    renderer.view.ghost =
      buildId && tile ? { id: buildId, x: tile.x, y: tile.y, valid: game.canBuildAt(tile.x, tile.y) && game.gold >= game.buildCost(buildId) } : null;
  }

  /** On-screen size of one tile, in CSS pixels. */
  function tilePx(): number {
    const a = renderer.toScreen(0, 0, 0);
    const b = renderer.toScreen(1, 0, 0);
    return Math.hypot(b.x - a.x, b.y - a.y);
  }

  /** A sensible first spot for the ghost: a free cell beside the road, near the middle of the view. */
  function defaultTile(): { x: number; y: number } | null {
    const b = game.board;
    const c = renderer.pickGround(innerWidth / 2, innerHeight * 0.45);
    let best: { x: number; y: number } | null = null;
    let bestScore = Infinity;
    for (let y = 0; y < b.height; y++) {
      for (let x = 0; x < b.width; x++) {
        if (!game.canBuildAt(x, y)) continue;
        const nearRoad = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([dx, dy]) => b.isWalkable(x + dx, y + dy));
        const score = Math.hypot(x + 0.5 - c.x, y + 0.5 - c.y) + (nearRoad ? 0 : 2.5);
        if (score < bestScore) {
          bestScore = score;
          best = { x, y };
        }
      }
    }
    return best;
  }

  function buildFailReason(x: number, y: number): string {
    if (game.towerAt(x, y)) return 'Ya hay una torre ahí';
    if (game.board.isWalkable(x, y)) return 'No se puede construir sobre el camino';
    return 'Casilla no disponible';
  }

  /** Builds the selected tower on a tile. Returns true when it was placed. */
  function tryBuild(x: number, y: number, keepMode: boolean): boolean {
    if (!buildId) return false;
    if (!game.canBuildAt(x, y)) {
      sfx('error');
      toast(buildFailReason(x, y));
      return false;
    }
    if (game.gold < game.buildCost(buildId)) {
      sfx('error');
      toast('Oro insuficiente');
      return false;
    }
    const t = game.build(buildId, x, y);
    if (!t) return false;
    if (tutorialStep === 0) {
      tutorialStep = 1;
      hint('¡Bien! Pulsa «Iniciar oleada» cuando estés listo. Puedes seguir construyendo durante la batalla.');
    }
    if (!keepMode || game.gold < game.buildCost(buildId)) selectBuild(null);
    else setGhost(null);
    return true;
  }

  function updateHover(x: number, y: number) {
    const tile = renderer.pickTile(x, y);
    renderer.view.hover = tile;
    if (buildId && !drag?.active) setGhost(tile);
    if (spellId) {
      const g = renderer.pickGround(x, y);
      renderer.view.spell = { id: spellId, x: g.x, y: g.y };
    }
    canvas.style.cursor = buildId || spellId ? 'crosshair' : tile && game.towerAt(tile.x, tile.y) ? 'pointer' : 'default';
  }

  function tap(x: number, y: number, pointerType: string, shift: boolean) {
    if (finished || game.phase === 'augment') return;
    if (spellId) {
      const g = renderer.pickGround(x, y);
      const id = spellId;
      if (pointerType === 'touch' && (!renderer.view.spell || Math.hypot(renderer.view.spell.x - g.x, renderer.view.spell.y - g.y) > 0.6)) {
        renderer.view.spell = { id, x: g.x, y: g.y };
        return;
      }
      if (game.castSpell(id, g.x, g.y)) {
        spellId = null;
        renderer.view.spell = null;
        for (const [, b] of spellBtns) toggleClass(b, 'on', false);
      }
      return;
    }
    const tile = renderer.pickTile(x, y);
    if (buildId) {
      // Touch placement is handled by the ghost drag; the mouse builds straight away.
      if (pointerType !== 'mouse' || !tile) return;
      const existing = game.towerAt(tile.x, tile.y);
      if (existing) {
        selectBuild(null);
        select(existing);
        return;
      }
      tryBuild(tile.x, tile.y, shift);
      return;
    }
    if (!tile) {
      select(null);
      return;
    }
    const t = game.towerAt(tile.x, tile.y);
    if (t) {
      sfx('click');
      select(selected === t ? null : t);
    } else select(null);
  }

  /** True when a screen point is over the battlefield rather than over a HUD element. */
  const overMap = (x: number, y: number) => document.elementFromPoint(x, y) === canvas;

  function moveDrag(x: number, y: number) {
    if (!drag || !buildId) return;
    if (drag.from === 'card' && !overMap(x, y)) {
      setGhost(null);
      return;
    }
    const tile = renderer.pickTile(x + drag.ox, y + drag.oy);
    if (!tile && drag.from === 'map') return; // off the board: leave the ghost where it was
    if (tile && (tile.x !== placing?.x || tile.y !== placing?.y) && placing) app.sfx('hover');
    setGhost(tile);
  }

  function onWindowMove(e: PointerEvent) {
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.sx;
    const dy = e.clientY - drag.sy;
    if (!drag.active) {
      if (drag.from === 'card') {
        // Pulling up lifts the tower out of the bar; sideways swipes keep scrolling the bar.
        const lift = drag.type === 'mouse' ? Math.hypot(dx, dy) > 8 : dy < -12 && -dy > Math.abs(dx) * 0.7;
        if (!lift) return;
        drag.active = true;
        hideTip();
        if (buildId !== drag.id) selectBuild(drag.id);
        placing = null;
        cards.get(drag.id)?.classList.add('dragging');
      } else if (Math.hypot(dx, dy) > 6) drag.active = true;
      else return;
    }
    moveDrag(e.clientX, e.clientY);
  }

  function onWindowUp(e: PointerEvent) {
    if (!drag || drag.pointerId !== e.pointerId) return;
    const d = drag;
    drag = null;
    cards.get(d.id)?.classList.remove('dragging');
    const cancelled = e.type === 'pointercancel';
    if (d.from === 'card') {
      if (!d.active) {
        if (cancelled) return;
        // A tap on the card: toggle build mode and drop a ghost the player can drag around.
        if (buildId === d.id) selectBuild(null);
        else {
          selectBuild(d.id);
          if (d.type !== 'mouse') setGhost(defaultTile());
        }
        return;
      }
      if (cancelled || !placing) {
        selectBuild(null);
        return;
      }
      // Released over the map: build right there. If the cell is not valid the ghost stays for adjusting.
      if (!tryBuild(placing.x, placing.y, false) && d.type === 'mouse') selectBuild(null);
      return;
    }
    // Ghost dragged or tapped on the map (touch).
    if (d.active || cancelled || !buildId || finished) return;
    const tile = renderer.pickTile(e.clientX, e.clientY);
    if (!tile) return;
    const existing = game.towerAt(tile.x, tile.y);
    if (existing && !(placing && placing.x === tile.x && placing.y === tile.y)) {
      selectBuild(null);
      sfx('click');
      select(existing);
    } else if (placing && placing.x === tile.x && placing.y === tile.y) tryBuild(tile.x, tile.y, false);
    else setGhost(tile);
  }
  window.addEventListener('pointermove', onWindowMove);
  window.addEventListener('pointerup', onWindowUp);
  window.addEventListener('pointercancel', onWindowUp);

  confirmOk.onclick = () => {
    if (placing) tryBuild(placing.x, placing.y, false);
  };
  confirmNo.onclick = () => selectBuild(null);

  function updateConfirm() {
    // Keep the battlefield clear while choosing a spot.
    if (hintEl) toggleClass(hintEl, 'away', !!buildId);
    toggleClass(rotateHint, 'away', !!buildId);
    const show = !!buildId && !!placing && lastPointer !== 'mouse' && !drag?.active && !finished && game.phase !== 'augment';
    confirmEl.style.display = show ? '' : 'none';
    if (!show || !placing || !buildId) return;
    const top = renderer.toScreen(placing.x + 0.5, placing.y + 0.5, GRASS_H + 1.35);
    const half = 70;
    const x = Math.min(innerWidth - half, Math.max(half, top.x));
    const y = Math.max(96, top.y);
    confirmEl.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -100%)`;
    toggleClass(confirmOk, 'disabled', !renderer.view.ghost?.valid);
    setText(confirmCost, String(game.buildCost(buildId)));
    toggleClass(confirmCost, 'short', game.gold < game.buildCost(buildId));
  }

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    lastPointer = e.pointerType;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false, type: e.pointerType });
    if (pointers.size === 2) {
      // Second finger: pinch / pan instead of moving the ghost.
      if (drag?.from === 'map') drag = null;
      const [a, b] = [...pointers.values()];
      pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      pinchZoom = renderer.zoom;
      pinchMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      return;
    }
    if (e.button === 2) {
      selectBuild(null);
      select(null);
      return;
    }
    if (buildId && e.pointerType !== 'mouse' && pointers.size === 1 && !finished) {
      // Grab the ghost where it is (keeping the finger offset) or, away from it, carry it above the finger.
      let ox = 0;
      let oy = -LIFT;
      if (placing) {
        const g = renderer.toScreen(placing.x + 0.5, placing.y + 0.5, GRASS_H);
        const size = tilePx();
        const near = Math.abs(e.clientX - g.x) < size * 0.9 && e.clientY < g.y + size * 0.5 && e.clientY > g.y - size * 1.9;
        if (near) {
          ox = g.x - e.clientX;
          oy = g.y - e.clientY;
        }
      }
      drag = { pointerId: e.pointerId, from: 'map', id: buildId, sx: e.clientX, sy: e.clientY, ox, oy, active: false, type: e.pointerType };
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) {
      if (e.pointerType === 'mouse') updateHover(e.clientX, e.clientY);
      return;
    }
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (Math.hypot(p.x - p.sx, p.y - p.sy) > 8) p.moved = true;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (pinchDist > 0) renderer.setZoom(pinchZoom * (d / pinchDist), mid.x, mid.y);
      renderer.pan(mid.x - pinchMid.x, mid.y - pinchMid.y);
      pinchMid = mid;
      for (const q of pointers.values()) q.moved = true;
      return;
    }
    if (drag?.from === 'map' && drag.pointerId === e.pointerId) return; // moving the ghost, not the camera
    if (p.moved) renderer.pan(dx, dy);
    else if (e.pointerType === 'mouse') updateHover(e.clientX, e.clientY);
  });
  const endPointer = (e: PointerEvent) => {
    const p = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchDist = 0;
    if (p && !p.moved && e.type === 'pointerup' && e.button !== 2) tap(e.clientX, e.clientY, p.type, e.shiftKey);
  };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('pointerleave', (e) => {
    if (e.pointerType !== 'mouse') return;
    renderer.view.hover = null;
    if (buildId && !drag) setGhost(null);
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      renderer.setZoom(renderer.zoom * Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY);
    },
    { passive: false },
  );

  // ------------------------------------------------------------ controls
  waveBtn.onclick = () => startWave();
  autoBtn.onclick = () => {
    autoWave = !autoWave;
    sfx('click');
    toggleClass(autoBtn, 'on', autoWave);
    autoBtn.style.color = autoWave ? '#7a5cd6' : '';
    toast(autoWave ? 'Oleadas automáticas activadas' : 'Oleadas automáticas desactivadas');
    if (autoWave && game.phase === 'build') startWave();
  };
  pauseBtn.onclick = () => openPause();
  speedBtn.onclick = () => {
    sfx('click');
    cycleSpeed();
  };

  function startWave() {
    if (!game.canStartWave()) return;
    const bonus = game.startNextWave();
    if (bonus > 0) toast(`¡Llamada anticipada! +${bonus} de oro`);
    if (tutorialStep === 1) {
      tutorialStep = 2;
      hint(null);
    }
  }

  function cycleSpeed() {
    const next = game.speed >= 3 ? 1 : game.speed + 1;
    game.speed = next;
    speedLabel.textContent = `×${next}`;
    toggleClass(speedBtn, 'on', next > 1);
  }

  let pauseModal: HTMLElement | null = null;
  function openPause() {
    if (finished || pauseModal || game.phase === 'augment') return;
    sfx('click');
    game.paused = true;
    const close = () => {
      pauseModal?.remove();
      pauseModal = null;
      game.paused = false;
    };
    pauseModal = h(
      'div.modal',
      h(
        'div.modal-card.panel',
        h('h2', 'Pausa'),
        h(
          'p.muted',
          `${mapDef.name} · ${DIFFICULTY[difficulty].name} · Oleada ${game.wave}${endless ? '' : `/${game.totalWaves}`} · mapa #${seedCode(run.seed)}`,
        ),
        game.augments.length
          ? h(
              'div',
              { style: 'display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:8px 0' },
              game.augments.map((a) => h('span.pill', { style: `color:${RARITY_INFO[a.rarity].color}` }, icon(a.icon, 14), a.name)),
            )
          : null,
        h(
          'div.actions',
          { style: 'flex-direction:column;align-items:stretch' },
          h('button.btn.primary.big', { onclick: () => (sfx('click'), close()) }, icon('play', 20), 'Continuar'),
          h(
            'button.btn',
            {
              onclick: () => {
                pauseModal!.style.display = 'none';
                openSettings(
                  app,
                  hud,
                  () => {
                    if (pauseModal) pauseModal.style.display = '';
                    renderer.view.showDamage = profile.settings.showDamageNumbers;
                    renderer.view.shakeEnabled = profile.settings.screenShake;
                  },
                  [],
                );
              },
            },
            icon('gear', 18),
            'Ajustes',
          ),
          h(
            'button.btn',
            { onclick: () => (sfx('click'), app.go({ name: 'game', biome: run.biome, seed: run.seed, difficulty, endless })) },
            icon('refresh', 18),
            'Reiniciar',
          ),
          h('button.btn.red', { onclick: () => abandon() }, icon('home', 18), 'Abandonar'),
        ),
      ),
    );
    hud.append(pauseModal);
  }

  function abandon() {
    sfx('click');
    pauseModal?.remove();
    pauseModal = null;
    finishRun(false, true);
  }

  // ------------------------------------------------------------ augments
  let augModal: HTMLElement | null = null;
  function showAugments(options: AugmentDef[]) {
    augModal?.remove();
    sfx('augment');
    selectBuild(null);
    const cardsEl = options.map((a, i) => {
      const r = RARITY_INFO[a.rarity];
      const c = h(
        'button.aug-card',
        { style: `--rc:${r.color};animation-delay:${i * 0.08}s` },
        h('div.aug-icon', icon(a.icon, 40)),
        h('div.txt', h('span.rarity', r.name), h('h3', a.name), h('p', a.description)),
      );
      c.onclick = () => {
        if (game.pickAugment(a.id)) {
          sfx('upgrade');
          augModal?.remove();
          augModal = null;
          renderAugs();
          toast(`${a.name} obtenida`);
        }
      };
      return c;
    });
    augModal = h(
      'div.modal',
      h(
        'div.aug-wrap',
        h('div.aug-title', h('h2', 'Elige una bendición'), h('div', `Oleada ${game.wavesCleared} superada · dura toda la partida`)),
        h('div.aug-cards', cardsEl),
        game.rerollsLeft > 0
          ? h(
              'button.btn.ghost',
              { onclick: () => (sfx('click'), game.rerollAugments()) },
              icon('refresh', 18),
              `Renovar opciones (${game.rerollsLeft})`,
            )
          : null,
      ),
    );
    hud.append(augModal);
    if (tutorialStep >= 0 && tutorialStep < 4) {
      tutorialStep = 4;
      hint(null);
    }
  }

  function renderAugs() {
    augsEl.replaceChildren(
      ...game.augments.map((a) => {
        const chip = h(`div.aug-chip.${a.rarity}`, icon(a.icon, 18));
        tip(chip, () => h('div', h('h4', a.name), h('div', a.description), h('div.muted', RARITY_INFO[a.rarity].name)));
        return chip;
      }),
    );
  }

  // ------------------------------------------------------------ game events
  const ev = game.events;
  ev.on('fire', ({ tower }) => {
    const kind = effectiveAttack(tower.def, tower.branch);
    const type = effectiveDamageType(tower.def, tower.branch);
    if (kind === 'beam' || kind === 'pulse') return;
    if (tower.def.id === 'ballista') sfx('bolt');
    else if (type === 'physical') sfx(kind === 'lob' || kind === 'cone' ? 'cannon' : 'arrow');
    else if (type === 'lightning') sfx('zap');
    else if (type === 'fire') sfx('fire');
    else if (type === 'frost') sfx('frost');
    else if (type === 'holy') sfx('holy');
    else if (type === 'shadow') sfx('shadow');
    else if (type === 'poison') sfx('poison');
    else sfx('magic');
  });
  ev.on('explosion', ({ style }) => style !== 'small' && style !== 'poison' && sfx('explosion'));
  ev.on('strike', ({ style }) => sfx(style === 'thunder' ? 'zap' : style === 'smite' ? 'holy' : 'explosion'));
  ev.on('kill', ({ enemy }) => {
    sfx(enemy.def.boss ? 'victory' : 'kill');
    if (enemy.def.boss) banner(`¡${enemy.def.name} derrotado!`, '', false);
  });
  ev.on('leak', () => {
    sfx('leak');
    livesStat.classList.remove('flash-red');
    void livesStat.offsetWidth;
    livesStat.classList.add('flash-red');
  });
  ev.on('build', () => sfx('build'));
  ev.on('upgrade', () => sfx('upgrade'));
  ev.on('sell', () => sfx('sell'));
  ev.on('gold', () => sfx('coin'));
  ev.on('shieldBreak', () => sfx('shield'));
  ev.on('spell', () => sfx('spell'));
  ev.on('spawn', ({ enemy }) => {
    if (!profile.seenEnemies.includes(enemy.def.id)) profile.seenEnemies.push(enemy.def.id);
  });
  ev.on('waveStart', ({ wave, boss }) => {
    if (boss) {
      sfx('boss');
      banner(`Oleada ${wave}`, `¡Se acerca ${ENEMIES[boss].name}!`, true);
    } else {
      sfx('waveStart');
      banner(`Oleada ${wave}`, wave === game.totalWaves ? '¡La batalla final!' : '');
    }
  });
  ev.on('waveCleared', ({ wave, reward, interest }) => {
    sfx('coin');
    toast(`Oleada ${wave} superada · +${reward + interest} de oro${interest ? ` (interés ${interest})` : ''}`);
    if (tutorialStep === 2) hint('Pulsa una torre para mejorarla. Al llegar al nivel 3 elegirás entre tres especializaciones.');
    if (wave >= 3 && tutorialStep >= 0) {
      profile.tutorialDone = true;
      app.save();
    }
  });
  ev.on('augmentOffer', ({ options }) => showAugments(options));
  ev.on('phase', ({ phase }) => {
    if (phase === 'victory') finishRun(true);
    else if (phase === 'defeat') finishRun(false);
    else if (phase === 'build' && autoWave) setTimeout(() => game.phase === 'build' && !finished && startWave(), 1200);
  });

  // ------------------------------------------------------------ end of run
  function finishRun(victory: boolean, abandoned = false) {
    if (finished) return;
    finished = true;
    game.paused = true;
    hint(null);
    const mapsBefore = new Set(BIOMES.filter((m) => isMapUnlocked(profile, m.requires)).map((m) => m.id));
    const g = game.global;
    const reward: RewardSummary = applyRunResult(profile, {
      mapId: run.biome,
      endless,
      difficulty,
      wavesCleared: game.wavesCleared,
      totalWaves: game.totalWaves,
      victory,
      towerXp: game.towerXp,
      kills: game.kills,
      bossesKilled: game.bossesKilled,
      starGain: g.starGain,
      xpGain: g.xpGain,
    });
    profile.tutorialDone = true;
    app.save();
    const newMaps = BIOMES.filter((m) => !mapsBefore.has(m.id) && isMapUnlocked(profile, m.requires)).map((m) => m.name);
    if (abandoned) {
      app.go({ name: 'menu' });
      return;
    }
    setTimeout(
      () => {
        sfx(victory ? 'victory' : 'defeat');
        const modal = h(
          'div.modal',
          h(
            'div.modal-card.panel',
            h(
              'div',
              { style: `color:${victory ? '#e2a01e' : '#a3362a'};display:flex;justify-content:center` },
              icon(victory ? 'crown' : 'skull', 56),
            ),
            h('h2', victory ? '¡Victoria!' : 'Derrota'),
            h(
              'p.muted',
              victory
                ? `Has defendido ${mapDef.name}.`
                : endless
                  ? `Resististe ${game.wavesCleared} oleadas en ${mapDef.name}.`
                  : `El castillo ha caído en la oleada ${game.wave}.`,
            ),
            h(
              'div.results',
              h('div.line', h('span', 'Oleadas superadas'), h('span', `${game.wavesCleared}/${game.totalWaves}`)),
              h('div.line', h('span', 'Enemigos abatidos'), h('span', String(game.kills))),
              h('div.line', h('span', 'Oro obtenido'), h('span', formatNumber(game.goldEarned))),
              h(
                'div.line',
                { style: 'background:#fff3c4' },
                h('span', reward.firstClear ? 'Estrellas (¡primera victoria!)' : 'Estrellas'),
                h('span', { style: 'display:flex;gap:4px;align-items:center;color:#8a5a12' }, `+${reward.stars}`, icon('star', 16)),
              ),
            ),
            newMaps.length
              ? h(
                  'div.pill',
                  { style: 'margin-top:10px;background:#efe6ff;color:#4b3596;padding:6px 12px' },
                  icon('map', 16),
                  `¡Nueva región desbloqueada: ${newMaps.join(', ')}!`,
                )
              : null,
            reward.levelUps.length
              ? h(
                  'div',
                  h('p', { style: 'margin:12px 0 4px;font-weight:800' }, 'Maestría de torres'),
                  h(
                    'div.levelups',
                    reward.levelUps.map((l) =>
                      h(
                        'span.levelup',
                        h('img', { src: towerPortrait(l.tower, 2, -1, 40) }),
                        `${TOWERS[l.tower].name.replace('Torre de ', '')} nv. ${l.to}`,
                      ),
                    ),
                  ),
                )
              : null,
            h(
              'div.actions',
              h('button.btn', { onclick: () => (sfx('click'), app.go({ name: 'maps' })) }, icon('map', 18), 'Mapas'),
              h('button.btn.purple', { onclick: () => (sfx('click'), app.go({ name: 'talents' })) }, icon('star', 18), 'Talentos'),
              h(
                'button.btn.primary',
                { onclick: () => (sfx('click'), app.go({ name: 'game', biome: run.biome, seed: run.seed, difficulty, endless })) },
                icon('refresh', 18),
                victory ? 'Jugar de nuevo' : 'Reintentar',
              ),
            ),
          ),
        );
        hud.append(modal);
      },
      victory ? 900 : 1400,
    );
  }

  // ------------------------------------------------------------ keyboard
  function onKey(e: KeyboardEvent) {
    if (e.repeat && e.key !== ' ') return;
    const k = e.key.toLowerCase();
    if (k === 'escape') {
      if (buildId || spellId) {
        selectBuild(null);
        spellId = null;
        renderer.view.spell = null;
        for (const [, b] of spellBtns) toggleClass(b, 'on', false);
      } else if (selected) select(null);
      else if (pauseModal) {
        pauseModal.remove();
        pauseModal = null;
        game.paused = false;
      } else openPause();
      return;
    }
    if (finished || augModal) return;
    if (k === 'p') openPause();
    else if (k === ' ') {
      e.preventDefault();
      startWave();
    } else if (k === 'f') cycleSpeed();
    else if (k === 'c') renderer.recenter();
    else if (k === 'h') hud.classList.toggle('hidden');
    else if (k === 'u' && selected) doUpgrade();
    else if (k === 's' && selected) doSell();
    else if (k === 'q') toggleSpell('meteor');
    else if (k === 'w' && game.unlockedSpells.has('frostNova')) toggleSpell('frostNova');
    else if (k === 'e' && game.unlockedSpells.has('blessing')) toggleSpell('blessing');
    else if (/^[0-9]$/.test(k)) {
      const idx = k === '0' ? 9 : Number(k) - 1;
      const t = TOWER_LIST[idx];
      if (t && unlocked.includes(t.id)) selectBuild(buildId === t.id ? null : t.id);
    }
  }

  // ------------------------------------------------------------ per frame
  function updateHud(dt: number) {
    setText(livesVal, `${game.lives}`);
    livesBar.style.width = `${Math.max(0, (game.lives / game.maxLives) * 100)}%`;
    if (game.lives < lastLives) lastLives = game.lives;
    const gold = Math.floor(game.gold);
    if (gold !== lastGold) {
      if (gold > lastGold && lastGold >= 0) {
        goldStat.classList.remove('bump');
        void goldStat.offsetWidth;
        goldStat.classList.add('bump');
      }
      lastGold = gold;
      setText(goldVal, formatNumber(gold));
      for (const t of TOWER_LIST) {
        const card = cards.get(t.id);
        const costEl = costEls.get(t.id);
        if (!card || !costEl || !unlocked.includes(t.id)) continue;
        const cost = game.buildCost(t.id);
        const txt = costEl.lastChild!;
        const label = cost === 0 ? 'GRATIS' : String(cost);
        if (txt.textContent !== label) txt.textContent = label;
        toggleClass(card, 'disabled', game.gold < cost);
        toggleClass(costEl, 'bad', game.gold < cost);
      }
    }
    setText(manaVal, `${Math.floor(game.mana)}`);
    manaBar.style.width = `${(game.mana / game.global.maxMana) * 100}%`;
    setText(waveVal, endless ? `${game.wave}` : `${game.wave}/${game.totalWaves}`);
    const canStart = game.canStartWave() && !finished;
    waveBtn.disabled = !canStart;
    const label = waveBtn.querySelector('.label') as HTMLElement;
    setText(label, game.phase === 'wave' ? `Llamar (+${10 + game.wave * 2})` : game.wave === 0 ? 'Iniciar oleada' : 'Siguiente oleada');
    toggleClass(waveBtn, 'green', game.phase === 'wave');
    toggleClass(waveBtn, 'primary', game.phase !== 'wave');
    for (const [id, btn] of spellBtns) {
      const def = SPELLS[id];
      const cd = game.spellCooldowns[id];
      const total = def.cooldown * Math.max(0.3, 1 + game.global.spellCooldown);
      const p = cd > 0 ? (cd / total) * 100 : game.mana < def.mana ? 100 - (game.mana / def.mana) * 100 : 0;
      (btn.firstChild as HTMLElement).style.setProperty('--p', `${p}%`);
      toggleClass(btn, 'disabled', !game.spellReady(id));
    }
    // Next wave preview
    const next = game.nextWaveDef();
    const sigPrev = next ? `${next.index}` : 'none';
    if (preview.dataset.sig !== sigPrev) {
      preview.dataset.sig = sigPrev;
      if (next) {
        preview.style.display = '';
        preview.replaceChildren(
          h('span', 'Siguiente:'),
          ...wavePreview(next).map((p) =>
            h('span.e', h('img', { src: enemyPortrait(p.enemy, 48), alt: ENEMIES[p.enemy].name, title: ENEMIES[p.enemy].name }), `×${p.count}`),
          ),
        );
      } else preview.style.display = 'none';
    }
    panelTimer -= dt;
    if (selected && panelTimer <= 0) {
      panelTimer = 0.25;
      if (!game.towers.includes(selected)) select(null);
      else renderPanel();
    }
  }

  // Debug/test hook (used by automated screenshot tests).
  (window as unknown as { __game?: unknown }).__game = { game, renderer, tap };

  let zoomedForPortrait = false;

  // Initial UI state
  renderer.insets = { top: 120, bottom: 120, left: 10, right: 10 };
  if (tutorialStep === 0)
    hint(
      'Arrastra una torre desde la barra inferior hasta una casilla junto al camino, o tócala y mueve la silueta por el mapa. Los enemigos salen del portal violeta.',
    );
  renderAugs();

  return {
    el,
    ownsStage: true,
    update(dt: number) {
      game.update(dt);
      if (placing) setGhost(placing);
      renderer.render(dt);
      updateHud(dt);
      updateConfirm();
    },
    resize() {
      const w = innerWidth;
      const hgt = innerHeight;
      const narrow = w < 640;
      const short = hgt < 520;
      renderer.insets = short
        ? { top: 44, bottom: 64, left: 6, right: 6 }
        : narrow
          ? { top: 130, bottom: 100, left: 6, right: 6 }
          : { top: 100, bottom: 104, left: 10, right: 10 };
      renderer.resize(w, hgt, window.devicePixelRatio || 1);
      const portrait = narrow && hgt > w * 1.2;
      rotateHint.style.display = portrait ? '' : 'none';
      // On tall phones the wide board would be tiny: start zoomed in (players can pinch/pan).
      if (portrait && !zoomedForPortrait) {
        zoomedForPortrait = true;
        renderer.setZoom(1.35);
      }
    },
    destroy() {
      hideTip();
      window.removeEventListener('pointermove', onWindowMove);
      window.removeEventListener('pointerup', onWindowUp);
      window.removeEventListener('pointercancel', onWindowUp);
      renderer.destroy();
      game.events.clear();
      app.save();
    },
    onKey,
  };
}

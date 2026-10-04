import { MAPS } from '../data/maps';
import type { Difficulty } from '../data/types';
import { AudioEngine } from '../engine/audio';
import { AutoPlayer, ALL_TOWERS } from '../game/autoplay';
import { Game } from '../game/game';
import { ModifierSet } from '../game/modifiers';
import { loadProfile, saveProfile, type Profile, type Storage } from '../meta/profile';
import { Renderer } from '../render/renderer';
import { h } from './dom';
import { hideTip } from './tooltip';

export interface Screen {
  el: HTMLElement;
  update?(dt: number): void;
  resize?(): void;
  destroy?(): void;
  /** Screens that draw their own world hide the menu backdrop. */
  ownsStage?: boolean;
  onKey?(e: KeyboardEvent): void;
}

export type Route =
  | { name: 'menu' }
  | { name: 'maps' }
  | { name: 'talents'; tab?: string }
  | { name: 'codex' }
  | { name: 'game'; map: string; difficulty: Difficulty };

type ScreenFactory = (app: App, route: Route) => Screen;

function safeStorage(): Storage | undefined {
  try {
    const s = window.localStorage;
    s.getItem('x');
    return s;
  } catch {
    return undefined;
  }
}

/** Owns the profile, audio, screen routing and the animated menu backdrop. */
export class App {
  readonly root: HTMLElement;
  readonly audio = new AudioEngine();
  readonly storage = safeStorage();
  profile: Profile;
  private screen: Screen | null = null;
  private stage: HTMLCanvasElement;
  private backdrop: { game: Game; renderer: Renderer; bot: AutoPlayer } | null = null;
  private last = performance.now();
  private factories = new Map<Route['name'], ScreenFactory>();

  constructor(root: HTMLElement) {
    this.root = root;
    this.profile = loadProfile(this.storage);
    this.stage = h('canvas.stage');
    this.root.appendChild(this.stage);
    this.audio.setVolumes(this.profile.settings.sfxVolume, this.profile.settings.musicVolume);
    const unlock = () => {
      this.audio.unlock();
      this.audio.startMusic();
    };
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('keydown', (e) => this.screen?.onKey?.(e));
    document.addEventListener('visibilitychange', () => {
      this.last = performance.now();
    });
    requestAnimationFrame((t) => this.frame(t));
  }

  register(name: Route['name'], f: ScreenFactory): void {
    this.factories.set(name, f);
  }

  go(route: Route): void {
    hideTip();
    this.screen?.destroy?.();
    this.screen?.el.remove();
    const f = this.factories.get(route.name);
    if (!f) throw new Error(`No screen ${route.name}`);
    this.screen = f(this, route);
    this.root.appendChild(this.screen.el);
    if (this.screen.ownsStage) this.stopBackdrop();
    else this.startBackdrop();
    this.audio.intensity = route.name === 'game' ? 1 : 0;
    this.resize();
  }

  save(): void {
    saveProfile(this.storage, this.profile);
  }

  sfx(name: Parameters<AudioEngine['play']>[0]): void {
    this.audio.play(name);
  }

  // ------------------------------------------------------------ backdrop

  private startBackdrop(): void {
    this.stage.style.display = 'block';
    this.stage.style.filter = 'blur(1.5px) saturate(1.05)';
    if (this.backdrop) return;
    const game = new Game({ map: MAPS[0], difficulty: 'easy', mods: new ModifierSet(), unlockedTowers: ALL_TOWERS, seed: 7 });
    const bot = new AutoPlayer(game, ALL_TOWERS, 7);
    // Fast-forward a little so the scene is lively from the first frame.
    for (let i = 0; i < 60 * 40; i++) {
      bot.update(1 / 60);
      if (!game.halted) game.step(1 / 60);
    }
    const renderer = new Renderer(this.stage, game);
    renderer.insets = { top: 20, bottom: 20, left: 0, right: 0 };
    renderer.view.showDamage = false;
    this.backdrop = { game, renderer, bot };
    this.resize();
  }

  private stopBackdrop(): void {
    this.stage.style.display = 'none';
    this.backdrop?.renderer.destroy();
    this.backdrop = null;
  }

  private resize(): void {
    if (this.backdrop) this.backdrop.renderer.resize(innerWidth, innerHeight, window.devicePixelRatio || 1);
    this.screen?.resize?.();
  }

  private frame(now: number): void {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (this.backdrop) {
      const b = this.backdrop;
      b.bot.update(dt);
      b.game.update(dt);
      if (b.game.isOver) {
        // Restart the demo when it ends.
        this.stopBackdrop();
        this.startBackdrop();
      } else b.renderer.render(dt);
    }
    this.screen?.update?.(dt);
    requestAnimationFrame((t) => this.frame(t));
  }
}

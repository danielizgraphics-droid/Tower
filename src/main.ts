// Self-hosted fonts (latin subset covers Spanish) so the game works offline.
import '@fontsource/rubik/latin-400.css';
import '@fontsource/rubik/latin-500.css';
import '@fontsource/rubik/latin-600.css';
import '@fontsource/rubik/latin-700.css';
import '@fontsource/rubik/latin-800.css';
import './ui/styles.css';
import type { Biome } from './data/biomes';
import type { Difficulty } from './data/types';
import { Renderer } from './render/renderer';
import { App } from './ui/app';
import { codexScreen } from './ui/screens/codex';
import { gameScreen } from './ui/screens/game';
import { mapsScreen } from './ui/screens/maps';
import { menuScreen } from './ui/screens/menu';
import { talentsScreen } from './ui/screens/talents';

// 3D renderer (WebGL + CC0 models) by default; ?r=2d forces the classic 2D renderer.
Renderer.use3D = new URLSearchParams(location.search).get('r') !== '2d';

const app = new App(document.getElementById('app')!);
app.register('menu', menuScreen);
app.register('maps', mapsScreen);
app.register('talents', talentsScreen);
app.register('codex', codexScreen);
app.register('game', gameScreen);

// Deep links (?screen=game&map=meadow&difficulty=normal) help testing and sharing.
const params = new URLSearchParams(location.search);
const screen = params.get('screen');
if (screen === 'game')
  app.go({
    name: 'game',
    biome: (params.get('biome') as Biome) ?? 'meadow',
    seed: Number(params.get('seed') ?? 12345),
    difficulty: (params.get('difficulty') as Difficulty) ?? 'normal',
    endless: params.get('endless') === '1',
  });
else if (screen === 'maps' || screen === 'talents' || screen === 'codex') app.go({ name: screen });
else app.go({ name: 'menu' });

(window as unknown as { __app: App }).__app = app;

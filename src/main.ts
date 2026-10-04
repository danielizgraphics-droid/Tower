import './ui/styles.css';
import type { Difficulty } from './data/types';
import { App } from './ui/app';
import { codexScreen } from './ui/screens/codex';
import { gameScreen } from './ui/screens/game';
import { mapsScreen } from './ui/screens/maps';
import { menuScreen } from './ui/screens/menu';
import { talentsScreen } from './ui/screens/talents';

const app = new App(document.getElementById('app')!);
app.register('menu', menuScreen);
app.register('maps', mapsScreen);
app.register('talents', talentsScreen);
app.register('codex', codexScreen);
app.register('game', gameScreen);

// Deep links (?screen=game&map=meadow&difficulty=normal) help testing and sharing.
const params = new URLSearchParams(location.search);
const screen = params.get('screen');
if (screen === 'game') app.go({ name: 'game', map: params.get('map') ?? 'meadow', difficulty: (params.get('difficulty') as Difficulty) ?? 'normal' });
else if (screen === 'maps' || screen === 'talents' || screen === 'codex') app.go({ name: screen });
else app.go({ name: 'menu' });

(window as unknown as { __app: App }).__app = app;

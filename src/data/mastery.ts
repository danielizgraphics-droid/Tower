// Tower mastery: for every tower, a series of four missions played with that
// tower alone (each a little harder, the third with a twist that suits the
// tower). Finishing the fourth grants the tower's mastery: a purely cosmetic
// golden look.

import type { MissionRules } from '../game/game';
import type { MissionDef } from './missions';
import type { Biome, Difficulty, TowerId } from './types';

interface Series {
  tower: TowerId;
  names: [string, string, string, string];
  stories: [string, string, string, string];
  /** Regions of the four battles. */
  biomes: [Biome, Biome, Biome, Biome];
  /** The third battle's twist (rules, and optionally another length or difficulty). */
  twist: { rules: MissionRules; waves?: number; difficulty?: Difficulty };
  /** Towers that may help (for towers that can't fight alone). */
  helpers?: TowerId[];
  /** Flooded maps (naval towers). */
  water?: number;
  /** Softer second / fourth battles for towers that struggle alone. */
  second?: { rules: MissionRules; difficulty?: Difficulty };
  final?: { rules: MissionRules; difficulty?: Difficulty };
}

/** Towers that only hit ground enemies get maps without flyers (unless a helper covers the air). */
const AIR = new Set<TowerId>(['archer', 'arcane', 'frost', 'storm', 'sanctum', 'obelisk', 'falconer', 'warden', 'hexhut']);

const SERIES: Series[] = [
  {
    tower: 'archer',
    names: ['Primera puntería', 'La guardia del valle', 'Ni un pájaro', 'Maestro arquero'],
    stories: [
      'Un recluta coge el arco por primera vez. Solo arqueros, en un valle tranquilo.',
      'Los arqueros defienden solos el bosque otoñal, y con pocas torres.',
      'Bandadas enteras sobre las islas del cielo. Los arqueros son los únicos que pueden pararlas.',
      'La prueba final del gremio: 20 oleadas de enemigos más duros, solo con arcos.',
    ],
    biomes: ['meadow', 'autumn', 'sky', 'canyon'],
    twist: { rules: {}, waves: 15 },
  },
  {
    tower: 'ballista',
    names: ['Cargar y tensar', 'Atravesando filas', 'Pocas pero certeras', 'Maestro balistero'],
    stories: [
      'Las balistas atraviesan a varios enemigos en línea. Aprende a colocarlas a lo largo del camino.',
      'Columnas largas de enemigos: perfectas para las saetas que atraviesan.',
      'Solo hay madera para 5 balistas. Mejóralas al máximo.',
      'El examen del maestro balistero, en el desierto.',
    ],
    biomes: ['meadow', 'coast', 'autumn', 'desert'],
    twist: { rules: { maxTowers: 5 } },
  },
  {
    tower: 'cannon',
    names: ['Pólvora y paciencia', 'Fuego de artillería', 'Pólvora mojada', 'Maestro artillero'],
    stories: [
      'Las bombardas golpean en área: espera a que los enemigos se agrupen.',
      'Una línea de cañones contra las hordas del cañón carmesí.',
      'En la ciénaga la pólvora escasea: poco oro inicial y pocas bombardas.',
      'El artillero mayor quiere ver 20 oleadas de explosiones en el desierto.',
    ],
    biomes: ['meadow', 'canyon', 'swamp', 'desert'],
    twist: { rules: { startGold: 150, maxTowers: 8 } },
    final: { rules: {} },
  },
  {
    tower: 'arcane',
    names: ['El primer hechizo', 'Biblioteca arcana', 'Sin especialización', 'Archimago'],
    stories: [
      'Las torres arcanas golpean a tierra y aire con magia pura.',
      'Los aprendices defienden la biblioteca del crepúsculo.',
      'La academia ha cerrado: torres arcanas solo hasta nivel 3.',
      'El título de archimago no se regala: 20 oleadas, enemigos más duros.',
    ],
    biomes: ['meadow', 'dusk', 'autumn', 'crystal'],
    twist: { rules: { maxTier: 3 } },
  },
  {
    tower: 'pyre',
    names: ['Chispa', 'Hoguera', 'Tierra quemada', 'Señor de las llamas'],
    stories: [
      'Las piras queman todo lo que pisa el camino. Sin voladores, por suerte.',
      'El fuego se propaga: deja que los enemigos ardan.',
      'En el desierto no hay nada que arder... salvo los enemigos.',
      'Arde el cañón carmesí: 20 oleadas solo con piras.',
    ],
    biomes: ['meadow', 'autumn', 'desert', 'canyon'],
    twist: { rules: {} },
    final: { rules: {}, difficulty: 'easy' },
  },
  {
    tower: 'frost',
    names: ['Escarcha', 'Viento del norte', 'Invierno eterno', 'Reina del hielo'],
    stories: [
      'Las agujas de escarcha frenan y congelan a sus objetivos.',
      'Hielo contra la marea de la costa.',
      'En las montañas heladas el invierno no termina nunca.',
      'Solo una maestra del hielo congela 20 oleadas en el bosque otoñal.',
    ],
    biomes: ['meadow', 'coast', 'snow', 'autumn'],
    twist: { rules: {}, difficulty: 'easy', waves: 18 },
    final: { rules: {}, difficulty: 'easy' },
  },
  {
    tower: 'storm',
    names: ['Primer trueno', 'Cadena de rayos', 'Tormenta en el cielo', 'Señor de la tormenta'],
    stories: [
      'Las torres de tormenta encadenan rayos entre enemigos.',
      'Cuanto más juntos van, más saltan los rayos.',
      'Sobre las nubes, contra una lluvia de voladores.',
      'La gran tormenta: 20 oleadas en la selva.',
    ],
    biomes: ['meadow', 'swamp', 'sky', 'jungle'],
    twist: { rules: {}, waves: 15 },
  },
  {
    tower: 'alchemist',
    names: ['Primer frasco', 'Nube tóxica', 'Laboratorio pobre', 'Gran alquimista'],
    stories: [
      'El veneno de los alquimistas se acumula sobre los enemigos de tierra.',
      'La ciénaga es el laboratorio perfecto.',
      'Sin presupuesto: poco oro y solo 8 alquimistas.',
      'El último experimento: 20 oleadas en la selva.',
    ],
    biomes: ['meadow', 'swamp', 'desert', 'jungle'],
    twist: { rules: { startGold: 130, maxTowers: 8 } },
  },
  {
    tower: 'sanctum',
    names: ['Plegaria', 'Luz sagrada', 'Fe ciega', 'Sumo sacerdote'],
    stories: [
      'Los santuarios golpean con luz sagrada a tierra y aire. Unos arqueros les acompañan.',
      'La luz contra los no muertos del crepúsculo.',
      'Sin hechizos: solo la fe de los santuarios.',
      'El sumo sacerdote debe resistir 20 oleadas en el jardín de los cerezos.',
    ],
    biomes: ['meadow', 'dusk', 'autumn', 'sakura'],
    helpers: ['archer'],
    twist: { rules: { noSpells: true } },
  },
  {
    tower: 'obelisk',
    names: ['Sombra', 'Susurros', 'Noche sin luna', 'Señor de las sombras'],
    stories: [
      'Los obeliscos sombríos roban la fuerza de sus víctimas.',
      'Sombras contra sombras en las ruinas del crepúsculo.',
      'En el reino de las sombras, enemigos muy duros pero pocas oleadas.',
      'Domina la oscuridad: 20 oleadas en el páramo de cristal.',
    ],
    biomes: ['meadow', 'dusk', 'shadow', 'crystal'],
    twist: { rules: {}, waves: 12, difficulty: 'easy' },
  },
  {
    tower: 'harbor',
    names: ['Botadura', 'Patrulla costera', 'Gran armada', 'Almirante'],
    stories: [
      'Los fuertes navales se construyen sobre el agua. La costa se ha inundado.',
      'Patrulla la costa con cañones de barco.',
      'Una inundación aún mayor y enemigos más duros.',
      'Solo un almirante defiende 20 oleadas desde el mar.',
    ],
    biomes: ['coast', 'coast', 'swamp', 'coast'],
    water: 6,
    twist: { rules: { hpMult: 1.15 } },
  },
  {
    tower: 'tide',
    names: ['Marea baja', 'Corrientes', 'Mar de fondo', 'Señora de las mareas'],
    stories: [
      'Los santuarios de las mareas empujan y frenan desde el agua.',
      'Las corrientes arrastran a los enemigos hacia atrás.',
      'La ciénaga inundada, con poco oro para empezar.',
      'La gran marea: 20 oleadas desde el agua.',
    ],
    biomes: ['coast', 'swamp', 'swamp', 'coast'],
    water: 6,
    twist: { rules: { startGold: 160 } },
    second: { rules: {}, difficulty: 'easy' },
    final: { rules: {}, difficulty: 'easy' },
  },
  {
    tower: 'quake',
    names: ['Temblor', 'Grietas', 'Terremoto', 'Corazón de la montaña'],
    stories: [
      'Los geomantes sacuden el suelo y aturden a los enemigos.',
      'Las paredes del cañón amplifican cada golpe.',
      'Solo 6 geomantes: elige bien dónde golpear.',
      'La montaña entera tiembla: 20 oleadas en el bosque otoñal.',
    ],
    biomes: ['meadow', 'canyon', 'canyon', 'autumn'],
    twist: { rules: { maxTowers: 6 } },
    final: { rules: {}, difficulty: 'easy' },
  },
  {
    tower: 'falconer',
    names: ['Primer vuelo', 'Ojos de halcón', 'Cetrería', 'Señor de los cielos'],
    stories: [
      'Los halconeros cazan voladores con facilidad; contra los de tierra les cuesta más.',
      'Halcones contra la selva.',
      'Sobre las islas del cielo los halcones están en su elemento.',
      'El maestro cetrero: 20 oleadas en las montañas heladas.',
    ],
    biomes: ['meadow', 'jungle', 'sky', 'snow'],
    twist: { rules: { hpMult: 1.15 }, waves: 18 },
  },
  {
    tower: 'market',
    names: ['Abrir el puesto', 'Gremio de mercaderes', 'Ruta comercial', 'Príncipe mercader'],
    stories: [
      'Los mercados no atacan: ganan oro y animan a las torres cercanas. Te acompañan unos arqueros.',
      'Más mercados, más oro, mejores arqueros.',
      'En el Valle Dorado empiezas casi sin oro: los mercados deben pagarlo todo.',
      'El príncipe mercader financia 20 oleadas de guerra.',
    ],
    biomes: ['meadow', 'autumn', 'gilded', 'canyon'],
    helpers: ['archer'],
    twist: { rules: { startGold: 100 } },
  },
  {
    tower: 'warden',
    names: ['Primera piedra', 'Murallas', 'Fortaleza solitaria', 'Señor del castillo'],
    stories: [
      'Los bastiones reales disparan a todo y refuerzan a sus vecinos.',
      'Una cadena de bastiones en el paso de montaña.',
      'Solo hay sitio para 4 bastiones: cada uno cuenta.',
      'El señor del castillo resiste 20 oleadas en el reino de las sombras.',
    ],
    biomes: ['meadow', 'snow', 'canyon', 'shadow'],
    twist: { rules: { maxTowers: 4 } },
  },
  {
    tower: 'sawmill',
    names: ['Primer corte', 'Serrería', 'Bosque talado', 'Maestro leñador'],
    stories: [
      'Las sierras atraviesan filas enteras de enemigos de tierra.',
      'El bosque otoñal da madera de sobra.',
      'Sin hechizos que ayuden: solo sierras.',
      'El gran leñador: 20 oleadas en la selva.',
    ],
    biomes: ['meadow', 'autumn', 'autumn', 'jungle'],
    twist: { rules: { noSpells: true } },
  },
  {
    tower: 'hexhut',
    names: ['Mal de ojo', 'Brujería', 'Aquelarre', 'Gran hechicero'],
    stories: [
      'Las chozas encadenan maldiciones que debilitan a los enemigos.',
      'Brujería en la ciénaga.',
      'En las ruinas del crepúsculo los enemigos son más duros.',
      'El gran hechicero: 20 oleadas en el reino de las sombras.',
    ],
    biomes: ['meadow', 'swamp', 'dusk', 'shadow'],
    twist: { rules: { hpMult: 1.2 } },
  },
];

/** Every mastery mission (four per tower, in order). */
export function masteryMissions(): MissionDef[] {
  const out: MissionDef[] = [];
  SERIES.forEach((s, i) => {
    const ground = !AIR.has(s.tower) && !s.helpers?.some((h) => AIR.has(h));
    for (let step = 1; step <= 4; step++) {
      const base: MissionRules = step === 2 ? (s.second?.rules ?? { maxTowers: 10 }) : step === 4 ? (s.final?.rules ?? { hpMult: 1.2 }) : {};
      const rules: MissionRules = { ...(step === 3 ? s.twist.rules : base), ...(ground ? { groundOnly: true } : {}) };
      out.push({
        id: `m-${s.tower}-${step}`,
        chapter: -1,
        name: s.names[step - 1],
        story: s.stories[step - 1],
        biome: s.biomes[step - 1],
        seed: 5000 + i * 10 + step,
        water: s.water,
        difficulty:
          step === 1
            ? 'easy'
            : step === 2
              ? (s.second?.difficulty ?? 'normal')
              : step === 3
                ? (s.twist.difficulty ?? 'normal')
                : (s.final?.difficulty ?? 'normal'),
        waves: step === 1 ? 12 : step === 2 ? 15 : step === 3 ? (s.twist.waves ?? 15) : 20,
        towers: [s.tower, ...(s.helpers ?? [])],
        rules,
        requires: step === 1 ? [] : [`m-${s.tower}-${step - 1}`],
        needsTower: s.tower,
        mastery: { tower: s.tower, step },
        reward: step === 4 ? { mastery: s.tower, stars: 10 } : { stars: [3, 4, 6][step - 1] },
      });
    }
  });
  return out;
}

/** Towers that have a mastery series. */
export const MASTERY_TOWERS: TowerId[] = SERIES.map((s) => s.tower);

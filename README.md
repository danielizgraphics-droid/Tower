# Bastión Arcano

Tower defense medieval con magia, en **vista isométrica** y con un estilo limpio e ilustrado.
Funciona en el navegador (escritorio y móvil) sin recursos externos: todos los gráficos, efectos y la
música se generan por código.

## Características

- **12 torres** (10 de tierra y 2 **navales** que se construyen sobre el agua: Fuerte Naval y Santuario de
  las Mareas), cada una con 3 niveles base y **3 especializaciones** (36 torres finales distintas), con su
  propio modelo por nivel y rama: puertas, ventanas iluminadas, estandartes, galeones, faros, kraken...
- **Capas de defensa enemiga** (escudo → armadura → vida) y **8 tipos de daño** con eficacias distintas.
- **32 enemigos** ilustrados con esqueleto animado (caminar, galopar, aletear) y contorno de ilustración:
  voladores, sanadores, invocadores, limos que se dividen, berserkers con frenesí, diablillos que se
  teletransportan, momias que resucitan, brujas que dan escudos, arietes imparables... Hay enemigos
  **regionales** y 6 jefes (3 de ellos propios de su región: Hidra, Coloso de magma y Escorpión rey).
- **Bendiciones cada 5 oleadas**: eliges 1 de 3 mejoras aleatorias (común / rara / épica) para la partida.
- **Progresión permanente**:
  - Árbol de talentos general (**Comandante**), pagado con estrellas: economía, defensa, arcano y estrategia.
  - Un **árbol de talentos por torre**: cada torre gana experiencia al infligir daño y cada nivel de
    maestría da un punto de talento (incluye potenciadores por especialización y una habilidad definitiva).
  - Desbloqueo de torres con estrellas.
- **3 hechizos** con maná (Lluvia de Meteoros, Nova de Escarcha, Bendición de Batalla).
- **Mapas procedurales**: cada partida genera un campo distinto (camino sinuoso, lagunas junto al camino,
  bosques y rocas) en **8 regiones**: prados, costa de coral (mar y palmeras), bosque otoñal, desierto de
  ámbar (oasis y cactus), pantano sombrío (sauces, setas y nenúfares), montañas heladas, tierras volcánicas
  (ríos de lava, ceniza y basalto) y ruinas del crepúsculo. Cada región se abre al llegar a la oleada 15 en
  la anterior. Cada mapa tiene un código que lo identifica y puedes pedir otro antes de empezar.
- **Modo campaña** (30 oleadas) o **modo infinito**: las oleadas no acaban nunca, cada 10 llega un jefe y los
  enemigos crecen exponencialmente. Se guarda tu récord por región.
- 3 dificultades.
- Códice (bestiario, torres, tabla de daño), ajustes, guardado automático y tutorial integrado.

## Controles

| Acción | Ratón / teclado | Táctil |
| --- | --- | --- |
| Construir | Elige una torre (1–0) y haz clic en la hierba | Toca la torre y toca dos veces la casilla |
| Seleccionar torre | Clic | Toque |
| Mejorar / vender | `U` / `S` | Botones del panel |
| Oleada | `Espacio` (llamarla antes da oro extra) | Botón de oleada |
| Hechizos | `Q` `W` `E` y clic en el mapa | Toca el hechizo y luego el mapa |
| Cámara | Rueda para zoom, arrastrar para mover, `C` centrar | Pellizcar y arrastrar |
| Velocidad / pausa | `F` / `P` o `Esc` | Botones superiores |

## Desarrollo

```bash
npm install
npm run dev           # servidor de desarrollo
npm test              # pruebas (lógica, progresión y simulaciones de equilibrio)
npm run typecheck
npm run build         # build estático en dist/
npm run build:single  # un único index.html autocontenido en dist-single/
npm run balance -- meadow normal none 3   # simulación de equilibrio con el jugador automático
```

## Arquitectura

```
src/
  data/      Contenido puro: torres, enemigos, mapas, mejoras de ronda, hechizos, tipos de daño
  game/      Simulación determinista sin DOM (oleadas, combate, modificadores, generador de mapas, jugador automático)
  meta/      Progresión persistente: perfil, árboles de talentos, recompensas
  render/    Proyección isométrica, primitivas sombreadas, modelos, sprites cacheados, efectos
  ui/        Pantallas y HUD en DOM, iconos SVG, estilos
  engine/    Utilidades: audio procedural, RNG, eventos, matemáticas
```

- **Escalable por datos**: añadir una torre, rama, enemigo, mapa o mejora consiste en añadir una entrada en
  `src/data/*`. Los talentos y mejoras son *modificadores* genéricos (`ModifierSet`) con alcance por torre,
  rama, tipo de daño o etiqueta.
- **Simulación desacoplada**: `Game` no depende del render, por lo que corre en las pruebas y en
  `scripts/balance.ts` para ajustar el equilibrio con un jugador automático.
- **Render eficiente**: el suelo y las partes estáticas de cada torre se pre-renderizan en sprites; solo las
  partes animadas se dibujan cada fotograma.

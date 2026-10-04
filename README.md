# Bastión Arcano

Tower defense medieval con magia, en **perspectiva caballera** y con un estilo limpio y minimalista.
Funciona en el navegador (escritorio y móvil) sin recursos externos: todos los gráficos, efectos y la
música se generan por código.

## Características

- **10 torres**, cada una con 3 niveles base y **3 especializaciones** (30 torres finales distintas),
  con su propio modelo visual por nivel y rama.
- **Capas de defensa enemiga** (escudo → armadura → vida) y **8 tipos de daño** con eficacias distintas.
- **17 enemigos**: voladores, sanadores, regeneradores, invocadores, limos que se dividen y 3 jefes.
- **Bendiciones cada 5 oleadas**: eliges 1 de 3 mejoras aleatorias (común / rara / épica) para la partida.
- **Progresión permanente**:
  - Árbol de talentos general (**Comandante**), pagado con estrellas: economía, defensa, arcano y estrategia.
  - Un **árbol de talentos por torre**: cada torre gana experiencia al infligir daño y cada nivel de
    maestría da un punto de talento (incluye potenciadores por especialización y una habilidad definitiva).
  - Desbloqueo de torres con estrellas.
- **3 hechizos** con maná (Lluvia de Meteoros, Nova de Escarcha, Bendición de Batalla).
- **4 mapas** temáticos (prado, bosque otoñal, paso nevado, ruinas al crepúsculo) y 3 dificultades.
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
  game/      Simulación determinista sin DOM (oleadas, combate, modificadores, jugador automático)
  meta/      Progresión persistente: perfil, árboles de talentos, recompensas
  render/    Proyección caballera, primitivas sombreadas, modelos, sprites cacheados, efectos
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

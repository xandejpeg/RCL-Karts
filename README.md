# RCL-Karts

Kart rental no navegador, no **KGV Circuito 101** (1.015 m, sentido horário), contra a IA.
Feito em three.js r180, sem build: é só servir a pasta como arquivos estáticos.

## Rodar

```bash
python -m http.server 8080   # depois abrir http://localhost:8080
node --test                   # testes (Node 20+)
```

## Teclas

| Tecla | Ação |
|---|---|
| `↑` `W` / `↓` `S` `Espaço` | acelera / freia |
| `←` `A` / `→` `D` | esterça (com ajuda: o comando é a curva pedida, como a IA pilota) |
| `T` | volta à pista (parado na linha de corrida) |
| `C` | câmera: segue, cockpit, TV, topo (no topo, arrastar gira e a roda aproxima) |
| `[` `]` | segue outro kart |
| `P` `Esc` | pausa |
| `R` | nova corrida |
| `H` | esconde o HUD |

**Controle** (Xbox/PlayStation): analógico esquerdo esterça, RT ou A acelera, LT ou B freia, Y volta à pista,
Back troca a câmera e Start pausa.

## Estrutura

| Caminho | O que é |
|---|---|
| `index.html` | página e importmap do `three` |
| `src/main.js` | liga pista, corrida, jogador, câmera e HUD |
| `src/jogador.js` | kart do jogador na corrida do Trânsito (`k.player`), ajuda no volante e volta à pista |
| `src/controle.js` | teclado e controle (Gamepad API) |
| `src/pista-dados.js` | geometria da pista sem three (testada no Node) |
| `src/pista.js` | desenho da pista: asfalto, zebras, linha de chegada, escape, pneus e Jersey |
| `src/camera.js`, `src/hud.js`, `src/tempo.js` | câmeras, torre de tempos e formato dos tempos (igual ao `LapTime` do TrackNight) |
| `src/style.css` | interface no Brand Guidelines do TrackNight |
| `assets/pista/tracado101.json` | eixo do 101 (509 pontos a cada 2 m, x leste, z sul). A largada é o primeiro ponto. |
| `vendor/rcl-transito/` | física e IA do RCL-Trânsito, em cópia congelada (ver `ORIGEM.md`) |
| `vendor/three/` | three.js r180 |
| `tests/` | testes em `node:test` |

## Etapas da v1

1. **Pista e corrida da IA** (feita).
2. **Kart do jogador: teclado e controle** (feita).
3. Calibragem com os tempos reais do 101.
4. Prova completa, torre, folha KGV e ranking local.
5. Kart 3D e pilotos de macacão e capacete.
6. Publicação em `karts.tracknightracing.com.br`.

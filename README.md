# RCL-Karts

Kart rental no navegador, no **KGV Circuito 101** (1.015 m, sentido horário), contra a IA.
Feito em three.js r180, sem build: é só servir a pasta como arquivos estáticos.

## Rodar

No Windows: dois cliques no `JOGAR.bat`. Ele sobe o servidor (só neste PC) e abre o `relevo.html`, o jogo com um
painel da altura do chão, da rampa e do perfil da volta (F2 esconde). Fechar a janela preta desliga o servidor.

```bash
node ferramentas/servidor.mjs 8080   # servidor sem cache (o python -m http.server também serve, mas o Chrome guarda os .js)
node --test                          # testes (Node 20+)
```

Pilotos de verdade: copie da frente Personagens (`rcl-motos/dist/assets/personagens/`) o `indice.json` e os `modelo.glb`
de `eu/v3`, `u10/v3`, `u20/v3`, `u28/v3`, `u30/v3`, `u32/v3` e `u0` para `assets/personagens/` (fora do git). Sem eles o
jogo abre com o piloto provisório.

## Teclas

Na tela inicial: nome na folha, modo (**Bateria KGV** de 18 min + 1 volta, **Corrida curta** de 5 voltas ou
**Treino livre**) e `Largar`. A largada é parada, com cinco luzes vermelhas.

| Tecla | Ação |
|---|---|
| `↑` `W` / `↓` `S` `Espaço` | acelera / freia; parado, segurar o freio puxa o kart de ré (mãos nas rodas da frente) |
| `←` `A` / `→` `D` | esterça (com ajuda: o comando é a curva pedida, como a IA pilota) |
| `T` | volta à pista (parado na linha de corrida) |
| `C` | câmera: segue, cockpit, TV, topo (no topo, arrastar gira e a roda aproxima) |
| `[` `]` | segue outro kart |
| `P` `Esc` | pausa (continuar, recomeçar ou menu) |
| `R` | recomeça a prova |
| `H` | esconde o HUD |

**Controle** (Xbox/PlayStation): analógico esquerdo esterça, RT ou A acelera, LT ou B freia, Y volta à pista,
Back troca a câmera e Start pausa.

## Estrutura

| Caminho | O que é |
|---|---|
| `index.html` | página e importmap do `three` |
| `relevo.html`, `JOGAR.bat` | o jogo com o painel de relevo por cima, e o atalho do Windows que abre ele |
| `src/main.js` | liga pista, corrida, jogador, câmera e HUD |
| `src/grid.js` | monta a corrida: 20 karts, largada parada em duas colunas, empenho da IA por volta |
| `src/calibragem.js` | física do 101 (GX390) e habilidade dos pilotos pela distribuição real de melhor volta |
| `src/karts.js` | números reais do KGV (002 a 072) e o jeito de cada kart (±0,5 s por volta) |
| `src/prova.js` | prova: luzes, setores S1/S2/S3, SFSpd, bandeirada, chegada e folha no formato KGV |
| `src/telas.js`, `src/ranking.js`, `src/nomes.js` | telas (início, pausa, folha, ranking), ranking local no navegador e nomes fictícios da IA |
| `src/jogador.js` | kart do jogador na corrida do Trânsito (`k.player`), ajuda no volante e volta à pista |
| `src/controle.js` | teclado e controle (Gamepad API) |
| `src/pista-dados.js` | geometria da pista sem three (testada no Node) |
| `src/pista.js` | desenho da pista: asfalto, zebras, linha de chegada, escape, pneus e Jersey |
| `src/camera.js`, `src/hud.js`, `src/tempo.js` | câmeras, torre de tempos e formato dos tempos (igual ao `LapTime` do TrackNight) |
| `src/style.css` | interface no Brand Guidelines do TrackNight |
| `assets/pista/tracado101.json` | eixo do 101 (509 pontos a cada 2 m, x leste, z sul), começando no ponto do mundo do RCL. O campo `cronometro.s` (32 m) é a linha de cronometragem. |
| `assets/arte.json` | arte que o jogo carrega (`kart`: GLB do contrato; `null` = desenho provisório) |
| `src/kart-contrato.js`, `src/kart-glb.js` | contrato da arte do kart (nós, `kart_pintura`, `kartPontos`, eixos do RCL) e o encaixe do GLB (`KartGlbView`): rodas, esterço, volante, cor, número, LOD |
| `src/cenario.js` | postes de luz, prédio dos boxes, torre de cronometragem e arquibancada (só desenho) |
| `src/pilotos.js`, `src/piloto-assento.js`, `src/ik.js` | pilotos da frente Personagens (`modelo.glb`, `Driving_Loop`, LOD 15/40 m) sentados no banco (bacia no ísquio, tronco 25° para trás, olhar na pista), mãos no aro e pés nos pedais por IK de dois ossos, tinta pela cor do kart |
| `vendor/rcl-transito/` | física e IA do RCL-Trânsito, em cópia congelada (ver `ORIGEM.md`) |
| `vendor/three/` | three.js r180 e o `GLTFLoader` |
| `tests/` | testes em `node:test`; `tests/fixtures/kart-contrato.glb` é o kart de teste do contrato |
| `ferramentas/` | `calibra.mjs` (volta limpa), `valida-corrida.mjs` (prova de 18 min contra os dados reais), `gera-kart-teste.mjs` (kart de teste) e `carga.mjs` (primeira carga contra a meta de 40 MB) |

## Linha de cronometragem

A volta, os setores, o SFSpd, a largada e a bandeirada usam a linha do TrackNight, em `cronometro.s` = 32 m depois do
primeiro ponto do eixo (decisão do Xande). O eixo não foi reordenado: continua o do mundo do RCL. O `traffic-kart.js`
segue contando as voltas dele no s = 0, mas a prova não usa essa conta.

## Arte do kart

Contrato (mensagem 007): GLB em metros, +X frente, +Y cima, +Z direita, origem no chão no meio dos eixos; nós `kart`,
`chassi`, `banco`, `motor`, `carenagem` (material `kart_pintura`), `esterco_E/D` com `roda_dianteira_E/D` dentro,
`roda_traseira_E/D`, `volante` e `numero_frente/E/D`; extras `kartPontos` (banco, volante, pedais, raioRodas) no nó
`kart`. Quando a arte chegar, é só pôr o caminho em `assets/arte.json`. Faltando nó obrigatório, o jogo avisa no console e
fica no provisório. Para ver o encaixe com o kart de teste: `?kart=teste`.

## Calibragem (dados reais do TrackNight, 101 no seco)

`node ferramentas/valida-corrida.mjs` roda uma prova de 18 min + 1 volta com 20 karts da IA, cronometrada na linha do
TrackNight, e compara com o real:

| Medida | Jogo | Real |
|---|---|---|
| Vencedor | 16 a 17 voltas em 18:02 a 19:02 | 14 a 17 voltas em 18:03 a 18:48 |
| Média do vencedor ÷ melhor da bateria | +8,4 a +10,4% | +7,2 a +9,6% |
| Melhor volta da bateria | 61,3 a 61,6 s | 59,3 a 62,2 s |
| Mediana das melhores voltas | 65,6 a 66,6 s | 64,6 s |
| Máxima da reta (piloto mais rápido) | 86,7 km/h | ~86 km/h |
| SFSpd na linha, mediana / p90 | 74,9–75,2 / 77,7–78,1 km/h | 76,7 / 83,2 km/h |

## Primeira carga

`node ferramentas/carga.mjs`: hoje 12,1 MB (2,3 MB do repositório e 9,8 MB dos 7 pilotos); com o kart previsto (2 MB)
14,1 MB; com o `piloto.glb` do jogador em close (11 MB) 25,1 MB. Meta: 40 MB.

## Etapas da v1

1. **Pista e corrida da IA** (feita).
2. **Kart do jogador: teclado e controle** (feita).
3. **Calibragem com os tempos reais do 101** (feita).
4. **Prova completa, torre, folha KGV e ranking local** (feita).
5. Kart 3D e pilotos de macacão e capacete: encaixe do GLB, cenário e pilotos sentados prontos; falta a arte do kart,
   o macacão, o capacete e a pose sentada no kart.
6. Publicação em `karts.tracknightracing.com.br`.

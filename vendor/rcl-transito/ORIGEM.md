# Origem dos arquivos desta pasta

Cópia congelada do RCL-Trânsito (frente dona dos arquivos), tirada de
`rcl-motos/dist/` no commit `492733c` (15/10/2026), sem nenhuma alteração:

- `traffic-kart.js`: pista (`KartTrack`), linha de corrida, física do kart a 120 Hz, pilotos da IA e corrida (`KartRace`).
- `traffic-kart-view.js`: desenho provisório dos karts (caixas e cilindros).

**Não editar aqui.** O RCL-Karts ajusta tudo por fora:

- calibragem pelo `cfg` do `KartRace`;
- pilotos por `setDriver`;
- kart do jogador por `k.player` e `k.inp`.

Mudança dentro destes arquivos só com o OK do RCL-Trânsito, e depois copiando de novo do rcl-motos.

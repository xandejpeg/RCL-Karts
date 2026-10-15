# Kart do Meshy → GLB do contrato (mensagem 007)

Ferramenta do chat RCL-Karts (Claude). Converte o kart gerado pelo Xande no Meshy (15/10/2026) em `assets/kart/kart.glb`.

O GLB original não entra no git (85 MB). Precisa de Python 3 com `numpy`, `scipy`, `pillow` e `pymeshlab`.

| Passo | Comando | O que faz |
|---|---|---|
| 1 | `python carrega.py <kart-do-meshy.glb>` | lê a malha e as 3 texturas (`kart_raw.npz`, `tex0..2.png`) |
| 2 | `python amostra.py` | pontos na superfície, para medir (`amostra.npz`) |
| 3 | `python dizima.py 45000` | dizima tudo junto, com textura (`diz45000.obj`) |
| 4 | `python segmenta.py diz45000.obj` | separa chassi, carenagem, banco, motor, 4 rodas e volante (`rotulos.npz`) |
| 5 | `python monta_glb.py kart.glb` | monta o GLB do contrato; `--debug` pinta cada parte de uma cor |

## Medidas tiradas do modelo (quadro do Meshy, frente em −x, motor em −z, que é a direita)

- Rodas: centro dianteiro x −0,5693, traseiro x 0,6748, altura −0,162; raio ~0,15. Entre-eixos 1,244 m.
- Chão em y −0,3147. Meio dos eixos em x 0,0528. Escala 1:1 (o modelo já está em metros: 1,90 × 1,17 m).
- Volante: centro do aro (−0,150; 0,197; 0), eixo (0,711; 0,703; 0), raio do aro 0,139.
- Banco: ponto do ísquio (0,09; −0,148; 0). Pedais (onde vai o tornozelo): (−0,58; −0,12; ±0,09).

## O que vai no GLB

Quadro do RCL (+X frente, +Y cima, +Z direita, origem no chão no meio dos eixos), 45 mil triângulos,
`KHR_mesh_quantization` (normal em int8, uv em uint16), texturas JPEG (cor 2048, normal 1024, metal/rugosidade 512).
A carenagem usa `kart_pintura`: o canal vermelho da textura vira cinza e a cor do piloto multiplica. Os números
(`numero_frente/E/D`) têm uv com v para cima, porque o `KartGlbView` escreve o número numa `CanvasTexture` (flipY).

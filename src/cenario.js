// Cenário do kartódromo (sem asset): postes de luz em volta da pista, prédio dos boxes com portas, torre de
// cronometragem na linha e arquibancada na reta principal. Só desenho: nada disso entra na física.
import * as T from 'three';
import { postes, naReta } from './pista-dados.js';

const mat = (cor, o = {}) => new T.MeshStandardMaterial({ color: cor, roughness: 0.85, metalness: 0.05, ...o });

// caixa de largura (ao longo da reta) × altura × fundo, apoiada no chão, no ponto (s, d) da reta, virada para a pista
function caixa(track, origem, s, d, [larg, alt, fundo], material, { y = 0 } = {}) {
  const r = naReta(track, origem, s, d), m = new T.Mesh(new T.BoxGeometry(fundo, alt, larg), material);
  m.position.set(r.x, y + alt / 2, r.z);
  m.rotation.y = r.rumo;
  m.castShadow = m.receiveShadow = true;
  return m;
}

export function montaCenario(scene, track, origem, linha) {
  const g = new T.Group();
  g.name = 'RCL-Karts:cenario';
  const borda = track.hw + (track.zebra || 0), lado = -1;   // boxes à esquerda da reta (no 101, o norte)

  // postes de luz: coluna e luminária acesa (emissiva), instanciados
  const lista = postes(track, origem);
  if (lista.length) {
    const coluna = new T.InstancedMesh(new T.CylinderGeometry(0.1, 0.14, 10, 8), mat(0x6b6f76, { metalness: 0.5, roughness: 0.4 }), lista.length);
    const lampada = new T.InstancedMesh(new T.BoxGeometry(1.2, 0.25, 0.6), mat(0x222226, { emissive: 0xfff4d6, emissiveIntensity: 2.2 }), lista.length);
    const M = new T.Matrix4();
    lista.forEach((p, i) => {
      coluna.setMatrixAt(i, M.makeTranslation(p.x, 5, p.z));
      lampada.setMatrixAt(i, M.makeTranslation(p.x, 10.1, p.z));
    });
    coluna.castShadow = true;
    g.add(coluna, lampada);
  }

  // prédio dos boxes: 110 m ao longo da reta, 10 m de fundo, com as portas viradas para a pista
  const sBoxes = linha - 25, dBoxes = lado * (borda + 18);
  g.add(caixa(track, origem, sBoxes, dBoxes, [110, 5.5, 10], mat(0xd9dbe0)));
  g.add(caixa(track, origem, sBoxes, dBoxes, [111, 0.4, 11], mat(0x2a2b30), { y: 5.5 }));
  const porta = mat(0x3a3d44, { metalness: 0.3, roughness: 0.5 });
  for (let i = -6; i <= 6; i++) g.add(caixa(track, origem, sBoxes + i * 8, dBoxes - lado * 5.05, [6, 3.6, 0.15], porta));

  // torre de cronometragem na linha, com a cabine envidraçada
  const dTorre = lado * (borda + 7);
  g.add(caixa(track, origem, linha, dTorre, [3, 7, 3], mat(0xe8e8ea)));
  g.add(caixa(track, origem, linha, dTorre, [3.6, 2.2, 3.6], mat(0x10141a, { metalness: 0.6, roughness: 0.15, emissive: 0x0a1a24 }), { y: 7 }));

  // arquibancada depois da torre: cinco degraus subindo para longe da pista, com cobertura
  const sArq = linha + 24, dArq = lado * (borda + 9);
  const degrau = mat(0x9aa0a8), assento = mat(0xc8202a);
  for (let i = 0; i < 5; i++) {
    g.add(caixa(track, origem, sArq, dArq + lado * i * 1.1, [30, 0.55 * (i + 1), 1.1], degrau));
    g.add(caixa(track, origem, sArq, dArq + lado * (i * 1.1 - 0.3), [29, 0.12, 0.4], assento, { y: 0.55 * (i + 1) }));
  }
  g.add(caixa(track, origem, sArq, dArq + lado * 2.2, [31, 0.15, 6.5], mat(0x2a2b30), { y: 6 }));
  for (const ds of [-15, 0, 15]) g.add(caixa(track, origem, sArq + ds, dArq + lado * 4.8, [0.2, 6, 0.2], mat(0x6b6f76)));

  scene.add(g);
  return g;
}

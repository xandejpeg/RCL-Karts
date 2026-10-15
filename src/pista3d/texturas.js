// Texturas da pista feitas no próprio navegador (canvas, com semente): asfalto, grama, areia, concreto, alambrado,
// lona dos boxes e o céu. Nada baixado de fora. Cada uma é feita uma vez e guardada.
import * as T from 'three';
import { sorteio } from './dados3d.js';

const guardadas = new Map();

// ruído de valor suave (grade aleatória interpolada), em 0–1, que repete na borda (para a textura emendar)
function ruido(r, tam, celula) {
  const n = Math.max(1, Math.round(tam / celula)), g = Float32Array.from({ length: n * n }, r);
  const at = (i, j) => g[((j % n) + n) % n * n + ((i % n) + n) % n];
  const liso = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const fx = (x / tam) * n, fy = (y / tam) * n, i = Math.floor(fx), j = Math.floor(fy), u = liso(fx - i), v = liso(fy - j);
    return (at(i, j) * (1 - u) + at(i + 1, j) * u) * (1 - v) + (at(i, j + 1) * (1 - u) + at(i + 1, j + 1) * u) * v;
  };
}

function canvas(tam, pinta) {
  const c = document.createElement('canvas');
  c.width = c.height = tam;
  const g = c.getContext('2d'), img = g.createImageData(tam, tam);
  pinta(img.data, tam);
  g.putImageData(img, 0, 0);
  return c;
}

function textura(nome, fazer, { repete = true, srgb = true, aniso = 8 } = {}) {
  if (guardadas.has(nome)) return guardadas.get(nome);
  const t = new T.CanvasTexture(fazer());
  if (repete) t.wrapS = t.wrapT = T.RepeatWrapping;
  if (srgb) t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = aniso;
  t.generateMipmaps = true;
  t.minFilter = T.LinearMipmapLinearFilter;
  guardadas.set(nome, t);
  return t;
}

// Asfalto: brita miúda clara e escura sobre o cinza, manchas largas e uns remendos mais escuros.
export function asfalto() {
  return textura('asfalto', () => canvas(1024, (d, tam) => {
    const r = sorteio(101), largo = ruido(r, tam, 256), medio = ruido(r, tam, 48);
    for (let y = 0; y < tam; y++) {
      for (let x = 0; x < tam; x++) {
        let v = 0.36 + (largo(x, y) - 0.5) * 0.08 + (medio(x, y) - 0.5) * 0.06;
        const q = r();
        if (q < 0.06) v += 0.12 + r() * 0.12;          // pedrinha clara
        else if (q < 0.16) v -= 0.08 + r() * 0.06;     // vão escuro
        else v += (r() - 0.5) * 0.05;
        const k = (y * tam + x) * 4, c = Math.max(0, Math.min(1, v)) * 255;
        d[k] = c; d[k + 1] = c; d[k + 2] = c * 1.03; d[k + 3] = 255;
      }
    }
  }));
}

// Grama: fios em tons de verde, manchas mais secas e mais verdes.
export function grama() {
  return textura('grama', () => canvas(512, (d, tam) => {
    const r = sorteio(202), largo = ruido(r, tam, 128), medio = ruido(r, tam, 24);
    for (let y = 0; y < tam; y++) {
      for (let x = 0; x < tam; x++) {
        const l = largo(x, y), m = medio(x, y), fio = r();
        const seco = Math.max(0, l - 0.6) * 0.9;
        const v = 0.78 + (m - 0.5) * 0.25 + (fio - 0.5) * 0.35;
        const k = (y * tam + x) * 4;
        d[k] = (0.27 + seco * 0.35) * v * 255;
        d[k + 1] = (0.46 + seco * 0.1) * v * 255;
        d[k + 2] = (0.17 + seco * 0.05) * v * 255;
        d[k + 3] = 255;
      }
    }
  }));
}

// Areia da área de escape: bege com grãos e pedrinhas.
export function areia() {
  return textura('areia', () => canvas(512, (d, tam) => {
    const r = sorteio(303), largo = ruido(r, tam, 96);
    for (let y = 0; y < tam; y++) {
      for (let x = 0; x < tam; x++) {
        let v = 0.82 + (largo(x, y) - 0.5) * 0.18 + (r() - 0.5) * 0.18;
        if (r() < 0.03) v -= 0.25;
        const k = (y * tam + x) * 4;
        d[k] = 0.66 * v * 255; d[k + 1] = 0.56 * v * 255; d[k + 2] = 0.42 * v * 255; d[k + 3] = 255;
      }
    }
  }));
}

// Concreto (Jersey, mureta, prédio): cinza claro, poros e manchas de chuva escorrendo (em y).
export function concreto() {
  return textura('concreto', () => canvas(512, (d, tam) => {
    const r = sorteio(404), largo = ruido(r, tam, 128), medio = ruido(r, tam, 16), coluna = ruido(r, tam, 32);
    for (let y = 0; y < tam; y++) {
      for (let x = 0; x < tam; x++) {
        let v = 0.74 + (largo(x, y) - 0.5) * 0.12 + (medio(x, y) - 0.5) * 0.06 + (r() - 0.5) * 0.06;
        v -= Math.max(0, coluna(x, y * 0.15) - 0.62) * 0.35;   // escorrido
        if (r() < 0.01) v -= 0.18;
        const k = (y * tam + x) * 4, c = Math.max(0, Math.min(1, v)) * 255;
        d[k] = c; d[k + 1] = c * 0.99; d[k + 2] = c * 0.96; d[k + 3] = 255;
      }
    }
  }));
}

// Alambrado: tela de losangos (arame galvanizado) com transparência, para alphaTest.
export function alambrado() {
  return textura('alambrado', () => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.clearRect(0, 0, 128, 128);
    g.strokeStyle = 'rgba(200,204,208,1)';
    g.lineWidth = 3;
    for (let k = -2; k <= 2; k++) {
      g.beginPath(); g.moveTo(k * 64, 0); g.lineTo(k * 64 + 128, 128); g.stroke();
      g.beginPath(); g.moveTo(k * 64 + 128, 0); g.lineTo(k * 64, 128); g.stroke();
    }
    return c;
  }, { aniso: 4 });
}

// Porta de enrolar dos boxes: ripas horizontais com sombra.
export function portaDeEnrolar() {
  return textura('porta', () => canvas(256, (d, tam) => {
    const r = sorteio(505);
    for (let y = 0; y < tam; y++) {
      const ripa = (y % 16) / 16, sombra = ripa < 0.12 ? 0.55 : ripa > 0.88 ? 0.8 : 1;
      for (let x = 0; x < tam; x++) {
        const v = (0.62 + (r() - 0.5) * 0.04) * sombra, k = (y * tam + x) * 4;
        d[k] = v * 255; d[k + 1] = v * 255; d[k + 2] = v * 1.04 * 255; d[k + 3] = 255;
      }
    }
  }));
}

// Placa escrita (texto da casa, sem marca de ninguém): fundo e letra na cor pedida. Redesenha quando a fonte da página
// (Barlow Condensed) termina de carregar.
export function placa(texto, { fundo = '#060608', letra = '#f4f4f6', largura = 1024, altura = 128, faixa = '#e10600' } = {}) {
  const desenha = (c) => {
    const g = c.getContext('2d');
    g.fillStyle = fundo; g.fillRect(0, 0, largura, altura);
    if (faixa) { g.fillStyle = faixa; g.fillRect(0, altura - altura * 0.12, largura, altura * 0.12); }
    g.fillStyle = letra;
    g.font = `italic 800 ${Math.round(altura * 0.62)}px "Barlow Condensed", "Arial Narrow", sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(texto, largura / 2, altura * 0.46);
    return c;
  };
  const chave = `placa:${texto}:${fundo}:${letra}:${faixa}`, nova = !guardadas.has(chave);
  const t = textura(chave, () => { const c = document.createElement('canvas'); c.width = largura; c.height = altura; return desenha(c); }, { repete: false });
  if (nova) document.fonts?.ready.then(() => { desenha(t.image); t.needsUpdate = true; });
  return t;
}

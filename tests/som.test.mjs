// RCL-Karts · som do kart: o motor GX390 (rotação, embreagem centrífuga, carga) e a síntese (MotorDSP), no Node.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MotorKart, MOTOR_GX390 as M, rpmDaRoda, kmhNoMaximo } from '../src/som/motor.js';
import { MotorDSP } from '../src/som/motor-dsp.js';

const roda = (m, s, entrada) => { for (let t = 0; t < s; t += 1 / 60) m.update(1 / 60, typeof entrada === 'function' ? entrada(t) : entrada); return m; };

test('motor: relação dá ~86 km/h perto do governador (o máximo das folhas do KGV)', () => {
  const r = rpmDaRoda(86 / 3.6);
  assert.ok(r > 3650 && r < M.max, `86 km/h = ${r} rpm`);
  assert.ok(kmhNoMaximo() > 85 && kmhNoMaximo() < 90, `${kmhNoMaximo()} km/h no governador`);
});

test('motor: lenta parado, pé embaixo patina na embreagem, colada na reta, solta freando', () => {
  const m = new MotorKart();
  roda(m, 2, { v: 0, acel: 0 });
  assert.ok(Math.abs(m.rpm - M.lenta) < 5 && !m.embreado && m.carga < 0.01, `lenta ${m.rpm}`);
  roda(m, 1.5, { v: 0, acel: 1 });
  assert.ok(Math.abs(m.rpm - M.estol) < 30 && !m.embreado && m.carga > 0.9, `patinando ${m.rpm} ${m.carga}`);
  roda(m, 1, { v: 80 / 3.6, acel: 1 });
  assert.ok(m.embreado && Math.abs(m.rpm - rpmDaRoda(80 / 3.6)) < 20, `colada ${m.rpm}`);
  roda(m, 1, { v: 70 / 3.6, acel: 0 });
  assert.ok(m.embreado && m.carga < 0.02, 'tirando o pé: motor puxado pela roda, sem carga');
  roda(m, 3, { v: 15 / 3.6, acel: 0 });
  assert.ok(!m.embreado && Math.abs(m.rpm - M.lenta) < 20, `freando até 15 km/h: solta e volta à lenta (${m.rpm})`);
  roda(m, 2, { v: 90 / 3.6, acel: 1 });
  assert.ok(m.rpm <= M.max + 40 && m.governador > 0.5 && m.carga < 0.5, `governador ${m.rpm} ${m.carga}`);
});

test('síntese: som finito e limitado, uma explosão a cada 2 voltas, mais alto com carga e giro', () => {
  const sr = 48000, rms = (rpm, carga, escorrega = 0) => {
    const d = new MotorDSP(sr, { semente: 5 }), b = new Float32Array(sr);
    d.processa(b, sr, { rpm, carga, escorrega }); d.processa(b, sr, { rpm, carga, escorrega });
    let s = 0; for (const x of b) { assert.ok(Number.isFinite(x) && Math.abs(x) <= 1); s += x * x; }
    return { rms: Math.sqrt(s / sr), b };
  };
  const lenta = rms(1400, 0), cheio = rms(2900, 1), alto = rms(3700, 1), pneu = rms(2900, 1, 1);
  assert.ok(cheio.rms > 2 * lenta.rms, `com carga mais alto: ${cheio.rms} × ${lenta.rms}`);
  assert.ok(alto.rms > cheio.rms, `mais giro mais alto: ${alto.rms} × ${cheio.rms}`);
  assert.ok(pneu.rms > cheio.rms, 'pneu cantando soma ao motor');
  // período pela autocorrelação na lenta: 2 × 60 / 1400 = 85,7 ms
  const b = lenta.b.subarray(0, sr / 2), n = b.length;
  let melhor = 0, L = 0;
  for (let lag = Math.round(sr * 0.05); lag < Math.round(sr * 0.12); lag++) { let s = 0; for (let i = 0; i + lag < n; i++) s += b[i] * b[i + lag]; if (s > melhor) { melhor = s; L = lag; } }
  assert.ok(Math.abs(L / sr - 120 / 1400) < 0.006, `período na lenta ${(L / sr * 1000).toFixed(1)} ms`);
});

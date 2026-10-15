// IK de dois ossos (braço: upperarm → lowerarm → hand; perna: thigh → calf → foot), analítico, no espaço do mundo:
// leva a ponta ao alvo mantendo o comprimento dos ossos, com o cotovelo/joelho dobrando para o lado do polo.
// Mexe só nas rotações locais dos dois primeiros ossos (a ponta acompanha).
import * as T from 'three';

const A = new T.Vector3(), B = new T.Vector3(), C = new T.Vector3(), Bd = new T.Vector3(), dir = new T.Vector3(), pv = new T.Vector3();
const u = new T.Vector3(), v = new T.Vector3(), q = new T.Quaternion(), qw = new T.Quaternion(), qp = new T.Quaternion();

// gira o osso no mundo para levar a direção `de` até `para` (vetores no mundo)
function giraNoMundo(osso, de, para) {
  if (de.lengthSq() < 1e-12 || para.lengthSq() < 1e-12) return;
  q.setFromUnitVectors(u.copy(de).normalize(), v.copy(para).normalize());
  osso.getWorldQuaternion(qw);
  if (osso.parent) osso.parent.getWorldQuaternion(qp); else qp.identity();
  osso.quaternion.copy(qp.invert().multiply(q).multiply(qw));
  osso.updateMatrixWorld(true);
}

export function ikDoisOssos(a, b, c, alvo, polo) {
  a.updateWorldMatrix(true, true);
  a.getWorldPosition(A); b.getWorldPosition(B); c.getWorldPosition(C);
  const l1 = A.distanceTo(B), l2 = B.distanceTo(C);
  dir.subVectors(alvo, A);
  const d = Math.min(Math.max(dir.length(), Math.abs(l1 - l2) + 1e-4), l1 + l2 - 1e-4);
  dir.normalize();
  // lado da dobra: o polo, tirada a parte na direção do alvo (sem polo útil, mantém a dobra atual)
  pv.subVectors(polo, A);
  pv.addScaledVector(dir, -pv.dot(dir));
  if (pv.lengthSq() < 1e-10) { pv.subVectors(B, A); pv.addScaledVector(dir, -pv.dot(dir)); }
  pv.normalize();
  const cosA = Math.min(1, Math.max(-1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))), sinA = Math.sqrt(1 - cosA * cosA);
  Bd.copy(A).addScaledVector(dir, l1 * cosA).addScaledVector(pv, l1 * sinA);
  giraNoMundo(a, B.sub(A), Bd.clone().sub(A));
  b.getWorldPosition(B); c.getWorldPosition(C);
  giraNoMundo(b, C.sub(B), alvo.clone().sub(B));
}

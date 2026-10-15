// Tempos no formato do TrackNight (LapTime): "1:02.168", "59.440", "18:07.073". Entrada em segundos.
export function tempo(seg) {
  if (seg == null || !Number.isFinite(seg)) return '—';
  const ms = Math.round(seg * 1000), m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000), f = String(ms % 1000).padStart(3, '0');
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}.${f}` : `${s}.${f}`;
}

export function numeroKart(n) {
  return String(n).padStart(3, '0');
}

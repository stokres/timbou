// Síntesis de percusión en JS puro: devuelve Float32Array mono a 44.1 kHz.
// Todos los sonidos del Studio se generan aquí; no se usa ningún sample de Musical Beings.
export const SR = 44100;
const TAU = Math.PI * 2;

function mkRng(seed) {
  let s = (seed || 1) >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return s / 2147483648 - 1;
  };
}

function biquad(type, f, q = 0.707) {
  const w = TAU * Math.min(f, SR * 0.45) / SR, c = Math.cos(w), al = Math.sin(w) / (2 * q);
  let b0, b1, b2;
  if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; }
  else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; }
  else { b0 = al; b1 = 0; b2 = -al; }
  const a0 = 1 + al, a1 = -2 * c, a2 = 1 - al;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return x => {
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    return y;
  };
}

const METAL = [1, 1.342, 1.2312, 1.6532, 1.9523, 2.1523];

function wave(type, p) {
  if (type === 'sine') return Math.sin(TAU * p);
  if (type === 'tri') return 1 - 4 * Math.abs(p - 0.5);
  if (type === 'saw') return 2 * p - 1;
  return p < 0.5 ? 1 : -1;
}

function renderLayer(L, out, seed) {
  const n = out.length, a = L.a ?? 1, d = L.d ?? 0.2, atk = L.atk ?? 0.0008;
  const env = t => (1 - Math.exp(-t / atk)) * Math.exp(-t / d);
  if (L.t === 'osc' || L.t === 'fm') {
    let ph = 0, mph = 0;
    const f1 = L.f, f0 = L.fTop ?? L.f, fd = L.fd ?? 0.03;
    for (let i = 0; i < n; i++) {
      const t = i / SR, f = f1 + (f0 - f1) * Math.exp(-t / fd);
      ph += f / SR;
      let v;
      if (L.t === 'fm') {
        mph += f * (L.ratio ?? 2) / SR;
        v = Math.sin(TAU * ph + (L.idx ?? 2) * Math.exp(-t / (L.id ?? d)) * Math.sin(TAU * mph));
      } else v = wave(L.wave || 'sine', ph % 1);
      out[i] += v * a * env(t);
    }
  } else if (L.t === 'noise') {
    const rnd = mkRng(seed), fs = [];
    if (L.hp) fs.push(biquad('hp', L.hp));
    if (L.lp) fs.push(biquad('lp', L.lp));
    if (L.bp) fs.push(biquad('bp', L.bp, L.q ?? 1));
    const nb = L.burst || 0, g = 0.012;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      let v = rnd();
      for (const f of fs) v = f(v);
      const e = t < nb * g ? Math.exp(-(t % g) / 0.003) : (1 - Math.exp(-(t - nb * g) / atk)) * Math.exp(-(t - nb * g) / d);
      out[i] += v * a * e * (L.bp ? 3 : 1);
    }
  } else if (L.t === 'metal') {
    const hp = biquad('hp', L.hp ?? 7000), ph = METAL.map(() => 0);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      let v = 0;
      for (let k = 0; k < 6; k++) { ph[k] = (ph[k] + L.f * METAL[k] / SR) % 1; v += ph[k] < 0.5 ? 1 : -1; }
      out[i] += hp(v / 6) * a * env(t) * 2;
    }
  }
}

export function synth(spec) {
  const n = Math.floor((spec.len ?? 0.5) * SR), out = new Float32Array(n);
  spec.layers.forEach((L, i) => renderLayer(L, out, 7919 * (i + 1) + n));
  const post = [];
  if (spec.lp) post.push(biquad('lp', spec.lp));
  if (spec.bp) post.push(biquad('bp', spec.bp, 0.8));
  const dr = spec.drive || 0;
  let peak = 0;
  for (let i = 0; i < n; i++) {
    let v = out[i];
    for (const f of post) v = f(v);
    if (dr) v = Math.tanh(v * dr);
    out[i] = v;
    if (Math.abs(v) > peak) peak = Math.abs(v);
  }
  const g = peak > 0 ? 0.9 / peak : 0, fade = Math.min(n, 400);
  for (let i = 0; i < n; i++) out[i] *= g * (i > n - fade ? (n - i) / fade : 1);
  return out;
}

// Recorta silencio inicial, limita duración y normaliza una grabación.
export function tidy(data, sr, maxSec = 5) {
  let peak = 0;
  for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
  if (peak < 1e-4) return new Float32Array(0);
  let start = 0;
  while (start < data.length && Math.abs(data[start]) < peak * 0.04) start++;
  start = Math.max(0, start - Math.floor(sr * 0.003));
  let end = data.length;
  while (end > start && Math.abs(data[end - 1]) < peak * 0.01) end--;
  end = Math.min(end, start + Math.floor(maxSec * sr));
  const out = data.slice(start, end), fade = Math.min(out.length, Math.floor(sr * 0.01));
  for (let i = 0; i < out.length; i++) out[i] *= (0.9 / peak) * (i > out.length - fade ? (out.length - i) / fade : 1);
  return out;
}

// Fábricas de sonidos
export const S = {
  kick: (f = 48, top = 170, d = 0.4, fd = 0.035, drive = 2, click = 0.25) => ({ len: Math.min(1.4, d * 4 + 0.1), drive, layers: [{ t: 'osc', f, fTop: top, fd, d, a: 1 }, { t: 'noise', hp: 2000, d: 0.006, a: click }] }),
  snare: (f = 185, d = 0.16, hp = 1800, tone = 0.6) => ({ len: Math.min(1, d * 5 + 0.1), drive: 1.3, layers: [{ t: 'osc', wave: 'tri', f, fTop: f * 1.6, fd: 0.02, d: d * 0.6, a: tone }, { t: 'noise', hp, d, a: 0.9 }] }),
  hat: (d = 0.04, hp = 7500, f = 420) => ({ len: Math.min(1.6, d * 6 + 0.05), layers: [{ t: 'metal', f, hp, d, a: 1 }, { t: 'noise', hp: hp * 1.1, d: d * 0.7, a: 0.4 }] }),
  clap: (bp = 1300, d = 0.13) => ({ len: 0.7, layers: [{ t: 'noise', bp, q: 1.2, hp: 600, d, a: 1, burst: 3 }] }),
  tom: (f = 120, d = 0.25) => ({ len: Math.min(1.2, d * 4), drive: 1.2, layers: [{ t: 'osc', f, fTop: f * 1.8, fd: 0.05, d, a: 1 }, { t: 'noise', lp: 1500, d: 0.02, a: 0.2 }] }),
  rim: (f = 1700, d = 0.025) => ({ len: 0.2, layers: [{ t: 'osc', wave: 'tri', f, d, a: 1 }, { t: 'osc', wave: 'sq', f: f * 0.29, d: d * 0.7, a: 0.4 }, { t: 'noise', hp: 3000, d: 0.004, a: 0.5 }] }),
  cow: (f = 545, d = 0.18) => ({ len: 0.8, drive: 1.5, bp: f * 1.6, layers: [{ t: 'osc', wave: 'sq', f, d, a: 0.6 }, { t: 'osc', wave: 'sq', f: f * 1.485, d, a: 0.6 }] }),
  shaker: (d = 0.05, hp = 5000) => ({ len: 0.35, layers: [{ t: 'noise', hp, d, atk: 0.012, a: 1 }] }),
  conga: (f = 220, d = 0.16) => ({ len: 0.7, layers: [{ t: 'osc', f, fTop: f * 1.25, fd: 0.015, d, a: 1 }, { t: 'noise', bp: f * 4, q: 2, d: 0.012, a: 0.5 }] }),
  tabla: (f = 300, d = 0.3, bend = 1, idx = 1.5) => ({ len: Math.min(1.6, d * 4), layers: [{ t: 'fm', f, fTop: f * bend, fd: 0.08, ratio: 1.51, idx, id: 0.04, d, a: 1 }, { t: 'noise', bp: f * 3, q: 3, d: 0.008, a: 0.4 }] }),
  bell: (f = 880, d = 0.5, ratio = 3.5, idx = 2) => ({ len: Math.min(2, d * 4), layers: [{ t: 'fm', f, ratio, idx, id: d * 0.5, d, a: 1 }] }),
  snap: (d = 0.05) => ({ len: 0.3, layers: [{ t: 'noise', bp: 2400, q: 2.5, d, a: 1, burst: 2 }] }),
  tamb: (d = 0.09) => ({ len: 0.5, layers: [{ t: 'metal', f: 900, hp: 6000, d, a: 0.7 }, { t: 'noise', hp: 7000, d: d * 1.2, a: 0.6 }] }),
  stab: (f = 220, d = 0.22, third = 1.189) => ({ len: 0.9, lp: 2200, layers: [1, third, 1.498].map(r => ({ t: 'osc', wave: 'saw', f: f * r, d, a: 0.5 })) }),
};

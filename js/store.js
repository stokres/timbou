import { KITS, ROWS, emptyGrid } from './kits.js';

const KEY = 'tembo-studio-v1';

export const defaultState = () => ({
  kit: 0, bpm: KITS[0].bpm, swing: KITS[0].swing, length: 8,
  grid: emptyGrid(),
  ch: Array.from({ length: ROWS }, () => ({ vol: 0.8, pitch: 0, delay: 0, reverb: 0, mute: false, side: 0 })),
  loops: [false, false, false, false], loopVol: 0.6,
  filter: 0, volume: 0.8,
  fxMode: 0,   // 0 volumen, 1 tono, 2 delay, 3 reverb
  knobMode: 0, // 0 bpm, 1 swing, 2 longitud
  tool: 1,     // 1 Beat, 3 apilado, 2 volteado, 0 borrar
  saved: [], done: {},
});

export const state = Object.assign(defaultState(), load());

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}

let timer;
export function save() {
  clearTimeout(timer);
  timer = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* sin almacenamiento */ } }, 300);
}

// Lo que se guarda como "patrón" o se exporta para transferir.
export const snapshot = () => JSON.parse(JSON.stringify({
  kit: state.kit, bpm: state.bpm, swing: state.swing, length: state.length, grid: state.grid,
  ch: state.ch, loops: state.loops, filter: state.filter,
}));
export function applySnapshot(p) {
  const d = defaultState();
  for (const k of ['kit', 'bpm', 'swing', 'length', 'grid', 'ch', 'loops', 'filter']) state[k] = p[k] ?? d[k];
}

export const beatCount = g => g.flat().reduce((a, v) => a + (v === 3 ? 2 : v ? 1 : 0), 0);

// IndexedDB mínimo para samples propios (los Float32Array no caben bien en localStorage).
let dbp;
function db() {
  return dbp ||= new Promise((res, rej) => {
    const r = indexedDB.open('tembo-studio', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
// Con límite de tiempo: en algunos navegadores IndexedDB se queda colgado sin dar error.
let dead = false;
const tx = (mode, fn) => dead ? Promise.resolve() : Promise.race([txRaw(mode, fn), new Promise(res => setTimeout(() => { dead = true; res(); }, 700))]);
const txRaw = async (mode, fn) => {
  const d = await db();
  return new Promise((res, rej) => {
    const rq = fn(d.transaction('kv', mode).objectStore('kv'));
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  });
};
export const idb = {
  get: k => tx('readonly', s => s.get(k)).catch(() => undefined),
  set: (k, v) => tx('readwrite', s => s.put(v, k)).catch(() => {}),
  del: k => tx('readwrite', s => s.delete(k)).catch(() => {}),
};

import { KITS, ROWS, emptyGrid } from './kits.js';

const KEY = 'timbou-v2';

export const defaultState = () => ({
  kit: 0, bpm: KITS[0].bpm, swing: KITS[0].swing, length: 8,
  grid: emptyGrid(),
  // fx = posición del dial «Channel FX dry-wet»; se aplica al efecto elegido con el selector de FX.
  ch: Array.from({ length: ROWS }, () => ({ vol: 0.8, fx: 0, mute: false, side: 0 })),
  loops: [false, false, false, false], loopVol: 0.6,
  fxSel: 0,    // 0 delay, 1 reverb, 2 tono, 3 gate, 4 filtro
  fxAmt: 0.5,  // dial «Global FX amount»
  volume: 0.8,
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

// Lo que se guarda como «patrón» o se exporta para transferir.
const FIELDS = ['kit', 'bpm', 'swing', 'length', 'grid', 'ch', 'loops', 'fxSel', 'fxAmt'];
export const snapshot = () => JSON.parse(JSON.stringify(Object.fromEntries(FIELDS.map(k => [k, state[k]]))));
export function applySnapshot(p) {
  const d = defaultState();
  for (const k of FIELDS) state[k] = p[k] ?? d[k];
  state.ch = state.ch.map((c, i) => ({ ...d.ch[i], ...c }));
}

export const beatCount = g => g.flat().reduce((a, v) => a + (v === 3 ? 2 : v ? 1 : 0), 0);

// IndexedDB mínimo para samples propios (los Float32Array no caben bien en localStorage).
let dbp;
function db() {
  return dbp ||= new Promise((res, rej) => {
    const r = indexedDB.open('timbou', 1);
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

import { KITS, PATTERNS, ANNOUNCED_PACKS, ROWS, MAX_BEATS, parseGrid, emptyGrid } from './kits.js';
import { state, save, snapshot, applySnapshot, beatCount } from './store.js';
import { Engine } from './engine.js';
import { createDevice, FX } from './device.js';
import { LESSONS, LEVELS, VIDEOS, diffCount } from './learn.js';

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const engine = new Engine();
const app = { tab: 'lib', lesson: null, level: 0, gameMsg: '', ear: -1, earStreak: 0, earMsg: '' };
window.tembo = { engine, state, app }; // para trastear desde la consola

let toastTimer;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3200); }

const hooks = {
  toast,
  changed() { save(); device.render(); renderTray(); checkLesson(); syncPanel(); },
  async setKit(k) {
    state.kit = k;
    if (engine.ctx) await engine.loadKit(k);
    device.showKit(); renderPanel(); hooks.changed();
  },
};
const device = createDevice($('#device'), engine, hooks);
engine.onChange = () => { device.render(); checkLesson(); renderPanel(); };

// --- Bandeja de Beats ---
const TOOLS = [[1, 'Beat', '1.ª semicorchea'], [3, 'Apilado', 'las dos'], [2, 'Volteado', '2.ª semicorchea'], [0, 'Quitar', '']];
function renderTray() {
  const used = beatCount(state.grid);
  $('#tray').innerHTML = TOOLS.map(([v, name, sub]) => `<button class="tool ${state.tool === v ? 'on' : ''}" data-tool="${v}"><span class="chip c${v}"></span><span><b>${name}</b>${sub ? `<small>${sub}</small>` : ''}</span></button>`).join('') +
    `<span class="count">Beats: <b>${used}</b>/${MAX_BEATS}</span>`;
}
$('#tray').addEventListener('click', e => { const b = e.target.closest('[data-tool]'); if (b) { state.tool = +b.dataset.tool; save(); renderTray(); } });

// --- Tutoriales ---
function startLesson(id) {
  // Cada lección empieza en limpio; lo que hubiera se guarda en «Mis patrones».
  if (beatCount(state.grid)) {
    state.saved = state.saved.filter(p => p.name !== 'Antes de la lección');
    state.saved.push({ name: 'Antes de la lección', ...snapshot() });
    toast('Tu patrón se guardó como «Antes de la lección».');
  }
  if (engine.playing) engine.stop();
  applySnapshot({ kit: state.kit, bpm: KITS[state.kit].bpm });
  engine.apply();
  app.lesson = { id, step: 0, snap: JSON.parse(JSON.stringify(state)) };
  save(); device.render(); renderTray();
  checkLesson(); renderPanel();
}
function checkLesson() {
  const L = app.lesson && LESSONS.find(l => l.id === app.lesson.id), coach = $('#coach');
  if (L) {
    const ctx = { s: state, e: engine, snap: app.lesson.snap };
    while (app.lesson.step < L.steps.length && L.steps[app.lesson.step].check(ctx)) app.lesson.step++;
    if (app.lesson.step >= L.steps.length) {
      state.done[L.id] = true; save(); app.lesson = null;
      toast(`¡Lección «${L.title}» completada!`); renderPanel();
    }
  }
  if (!app.lesson) { coach.hidden = true; return; }
  coach.hidden = false;
  coach.innerHTML = `<div><b>${esc(L.title)}</b> · paso ${app.lesson.step + 1} de ${L.steps.length}<p>${esc(L.steps[app.lesson.step].text)}</p></div><button data-cmd="quit">Salir</button>`;
}
$('#coach').addEventListener('click', e => { if (e.target.dataset.cmd === 'quit') { app.lesson = null; checkLesson(); } });

// --- Panel ---
const TABS = [['lib', 'Biblioteca'], ['ch', 'Canales'], ['learn', 'Aprender'], ['guide', 'Guía']];
const slider = (label, bind, i, min, max, step, val) => `<label class="sl">${label}<input type="range" min="${min}" max="${max}" step="${step}" value="${val}" data-bind="${bind}" data-i="${i}"></label>`;

const views = {
  lib: () => `
    <h3>Kits de fábrica <small>8 kits · 5 canales · 2 samples por canal</small></h3>
    <div class="cards">${KITS.map((k, i) => `<button class="card ${i === state.kit ? 'on' : ''}" data-cmd="kit" data-i="${i}"><b>${i + 1}. ${k.name}</b><small>${k.sounds.map(s => s[0].name).join(' · ')}</small></button>`).join('')}</div>
    <h3>Patrones de ejemplo</h3>
    <div class="chips">${PATTERNS.map((p, i) => `<button data-cmd="pat" data-i="${i}">${p.name}</button>`).join('')}</div>
    <h3>Mis patrones</h3>
    <div class="row"><input id="pname" placeholder="Nombre del patrón" maxlength="30"><button data-cmd="savepat">Guardar</button></div>
    ${state.saved.length ? `<ul class="list">${state.saved.map((p, i) => `<li><span>${esc(p.name)}</span><button data-cmd="loadpat" data-i="${i}">Cargar</button><button data-cmd="delpat" data-i="${i}" title="Borrar">✕</button></li>`).join('')}</ul>` : '<p class="muted">Aún no has guardado ninguno.</p>'}
    <div class="row"><button data-cmd="export">Exportar .json</button><label class="filebtn">Importar .json<input type="file" accept=".json,application/json" data-file="import"></label><button data-cmd="clear">Vaciar rejilla</button></div>
    <h3>Biblioteca anunciada <small>no incluida aquí</small></h3>
    <div class="chips locked">${ANNOUNCED_PACKS.map(p => `<span>${p}</span>`).join('')}</div>`,

  ch: () => `
    <h3>Canales <small>kit ${state.kit + 1}: ${KITS[state.kit].name}</small></h3>
    ${state.ch.map((c, r) => {
      const nm = s => engine.names[r] ? esc(engine.names[r][s]) + (engine.custom[r][s] ? ' ★' : '') : KITS[state.kit].sounds[r][s].name;
      return `<div class="chrow"><div class="chhead"><b>${r + 1}</b><span class="${c.side === 0 ? 'sel' : ''}">A: ${nm(0)}</span><span class="${c.side === 1 ? 'sel' : ''}">B: ${nm(1)}</span></div>
      <div class="row"><button data-cmd="aud" data-i="${r}">▶ Escuchar</button><label class="filebtn">Cargar audio<input type="file" accept="audio/*" data-file="sample" data-i="${r}"></label><button data-cmd="recch" data-i="${r}">${engine.micCh === r ? '■ Parar' : '● Grabar'}</button>${engine.custom[r]?.[c.side] ? `<button data-cmd="restore" data-i="${r}">Restaurar</button>` : ''}</div>
      <div class="sliders">${slider('Vol', 'vol', r, 0, 1, 0.01, c.vol)}${slider('Tono', 'pitch', r, -24, 24, 1, c.pitch)}${slider('Delay', 'delay', r, 0, 1, 0.01, c.delay)}${slider('Reverb', 'reverb', r, 0, 1, 0.01, c.reverb)}</div></div>`;
    }).join('')}
    <p class="muted">Cargar o grabar sustituye el sample seleccionado (A o B) de ese canal en este kit. ★ = sample propio.</p>
    <h3>Loops <small>4 canales de acompañamiento</small></h3>
    ${[0, 1, 2, 3].map(i => `<div class="looprow"><label><input type="checkbox" data-cmd="loop" data-i="${i}" ${state.loops[i] ? 'checked' : ''}> ${i + 1}. ${engine.loopSlots[i] ? 'Resample del patrón' : KITS[state.kit].loops.parts[i].name}</label><button data-cmd="resample" data-i="${i}">Resamplear aquí</button>${engine.loopSlots[i] ? `<button data-cmd="loopreset" data-i="${i}">Fábrica</button>` : ''}</div>`).join('')}
    <div class="sliders">${slider('Volumen de loops', 'loopVol', 0, 0, 1, 0.01, state.loopVol)}</div>`,

  learn: () => {
    const lv = LEVELS[app.level];
    return `
    <h3>Tutoriales interactivos</h3>
    <ul class="list">${LESSONS.map(l => `<li><span>${state.done[l.id] ? '✓ ' : ''}${l.title} <small>${l.steps.length} pasos</small></span><button data-cmd="lesson" data-id="${l.id}">${app.lesson?.id === l.id ? 'En curso' : 'Empezar'}</button></li>`).join('')}</ul>
    <h3>Juego: copia el ritmo</h3>
    <div class="chips">${LEVELS.map((l, i) => `<button class="${i === app.level ? 'on' : ''}" data-cmd="level" data-i="${i}">${state.done['lvl' + i] ? '✓ ' : ''}${i + 1}. ${l.name}</button>`).join('')}</div>
    <p>Nivel ${app.level + 1}: escucha el ritmo y reconstrúyelo en la rejilla (${beatCount(lv.grid)} Beats).</p>
    <div class="row"><button data-cmd="listen">▶ Escuchar objetivo</button><button data-cmd="check">Comprobar</button><button data-cmd="clear">Vaciar rejilla</button></div>
    <p class="msg">${esc(app.gameMsg)}</p>
    <h3>Juego: ¿qué canal suena?</h3>
    <div class="row"><button data-cmd="earplay">▶ ${app.ear < 0 ? 'Reproducir sonido' : 'Repetir'}</button><span class="muted">Racha: ${app.earStreak}</span></div>
    <div class="chips">${[0, 1, 2, 3, 4].map(i => `<button data-cmd="earpick" data-i="${i}">Canal ${i + 1}</button>`).join('')}</div>
    <p class="msg">${esc(app.earMsg)}</p>
    <h3>Vídeos</h3>
    <ul class="list">${VIDEOS.map(([t, u]) => `<li><a href="${u}" target="_blank" rel="noopener">${t} ↗</a></li>`).join('')}</ul>`;
  },

  guide: () => `
    <h3>Cómo se toca</h3>
    <ul class="guide">
      <li><b>Rejilla 8×5.</b> Cada fila es un canal (instrumento) y cada columna, dos semicorcheas: 16 pasos en total.</li>
      <li><b>Beat</b> = primera semicorchea · <b>Volteado</b> = segunda · <b>Apilado</b> = las dos. Hay 30 Beats, como en la caja real. Clic derecho quita un Beat.</li>
      <li><b>Izquierda de la rejilla:</b> mute por canal.</li>
      <li><b>Derecha de la rejilla:</b> sample flip (A/B) y, a su lado, un dial por canal.</li>
      <li><b>Botón de efectos</b> (abajo a la derecha): decide qué controlan los diales — ${FX.join(', ')}. Tono: ±24 semitonos.</li>
      <li><b>Dial de filtro:</b> a la izquierda paso bajo, a la derecha paso alto.</li>
      <li><b>Transporte:</b> play/pausa, grabar sesión (descarga audio) y selector de kit.</li>
      <li><b>Pantalla + dial grande:</b> clic para alternar BPM / swing / pasos; arrastra o usa la rueda para ajustar.</li>
      <li><b>Cuatro botones de loop:</b> acompañamientos sincronizados; se pueden sustituir por un resample del patrón.</li>
      <li><b>Sampler:</b> pulsa la cápsula del micro y después el botón de un canal para grabar (máx. 5 s).</li>
      <li>Doble clic en un dial lo restablece. Barra espaciadora: play/pausa.</li>
    </ul>
    <h3>Qué es esto</h3>
    <p>Una recreación personal y no oficial para practicar mientras llega el Studio de Musical Beings. Los sonidos se sintetizan aquí; no contiene samples ni contenido de Tembo.</p>
    <p class="muted">Confirmado por fuentes públicas: rejilla 8×5, Beat/volteado/apilado, 5 canales con volumen, tono (±24) y envíos a delay y reverb, 2 samples por canal, 8 kits, 4 canales de loop, resampleo, swing, longitud de patrón, filtro, mute, sampler y grabación de sesión. Es interpretación mía: qué botón físico hace cada cosa en el diseño nuevo, la selección por modos y el contenido concreto de kits, loops y lecciones. Detalle en <a href="docs/RESEARCH.md" target="_blank">docs/RESEARCH.md</a>.</p>`,
};

function renderPanel() {
  $('#tabs').innerHTML = TABS.map(([id, name]) => `<button class="${app.tab === id ? 'on' : ''}" data-tab="${id}">${name}</button>`).join('');
  const keep = $('#pname')?.value;
  $('#view').innerHTML = views[app.tab]();
  if (keep && $('#pname')) $('#pname').value = keep;
}
function syncPanel() {
  document.querySelectorAll('#view [data-bind]').forEach(el => {
    const b = el.dataset.bind, v = b === 'loopVol' ? state.loopVol : state.ch[+el.dataset.i][b];
    if (document.activeElement !== el && +el.value !== v) el.value = v;
  });
  document.querySelectorAll('#view [data-cmd="loop"]').forEach(el => { el.checked = state.loops[+el.dataset.i]; });
}

$('#tabs').addEventListener('click', e => { if (e.target.dataset.tab) { app.tab = e.target.dataset.tab; renderPanel(); } });

$('#view').addEventListener('input', e => {
  const el = e.target, b = el.dataset.bind;
  if (!b) return;
  if (b === 'loopVol') state.loopVol = +el.value; else state.ch[+el.dataset.i][b] = +el.value;
  engine.apply(); save(); device.render(); checkLesson();
});

$('#view').addEventListener('change', async e => {
  const el = e.target, f = el.files?.[0];
  if (!el.dataset.file || !f) return;
  try {
    if (el.dataset.file === 'sample') { await engine.loadFile(+el.dataset.i, f); toast(`Sample cargado en el canal ${+el.dataset.i + 1}.`); }
    else {
      const j = JSON.parse(await f.text());
      applySnapshot(j.pattern || j); await hooks.setKit(state.kit); engine.apply(); toast('Patrón importado.');
    }
  } catch { toast('No se pudo leer ese archivo.'); }
  renderPanel(); hooks.changed();
});

const cmds = {
  kit: i => hooks.setKit(i),
  async pat(i) { const p = PATTERNS[i]; state.grid = parseGrid(p.rows); state.bpm = p.bpm; state.swing = p.swing; state.length = 8; await hooks.setKit(p.kit); },
  savepat() { const name = $('#pname').value.trim() || `Patrón ${state.saved.length + 1}`; state.saved.push({ name, ...snapshot() }); $('#pname').value = ''; toast(`Guardado «${name}».`); },
  async loadpat(i) { applySnapshot(JSON.parse(JSON.stringify(state.saved[i]))); await hooks.setKit(state.kit); },
  delpat(i) { state.saved.splice(i, 1); },
  export() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ app: 'tembo-studio-no-oficial', version: 1, pattern: snapshot() }, null, 2)], { type: 'application/json' }));
    a.download = 'tembo-patron.json'; a.click();
  },
  clear() { state.grid = emptyGrid(); },
  aud: i => engine.trigger(i),
  async recch(i) { if (engine.micRec) return engine.micStop(); try { await engine.micStart(i); } catch { toast('No se pudo acceder al micrófono.'); } },
  restore: i => engine.clearCustom(i, state.ch[i].side),
  loop(i) { state.loops[i] = !state.loops[i]; },
  async resample(i) { await engine.resample(i); state.loops[i] = true; toast(`Patrón resampleado en el loop ${i + 1}.`); },
  loopreset(i) { engine.loopSlots[i] = null; },
  lesson: (_, el) => startLesson(el.dataset.id),
  level(i) { app.level = i; app.gameMsg = ''; },
  listen() { state.bpm = LEVELS[app.level].bpm; state.length = 8; return engine.playTarget(LEVELS[app.level].grid); },
  check() {
    const d = diffCount(state.grid, LEVELS[app.level].grid);
    if (d) app.gameMsg = `Casi: ${d} casilla${d > 1 ? 's' : ''} no coincide${d > 1 ? 'n' : ''}. Vuelve a escuchar.`;
    else { state.done['lvl' + app.level] = true; app.gameMsg = '¡Perfecto! Nivel superado.'; if (app.level < LEVELS.length - 1) app.level++; }
  },
  earplay() { if (app.ear < 0) app.ear = Math.floor(Math.random() * ROWS); app.earMsg = ''; engine.trigger(app.ear); },
  earpick(i) {
    if (app.ear < 0) { app.earMsg = 'Primero reproduce un sonido.'; return; }
    if (i === app.ear) { app.earStreak++; app.earMsg = '¡Correcto! Pulsa para el siguiente.'; app.ear = -1; }
    else { app.earStreak = 0; app.earMsg = 'No era ese. Prueba otra vez.'; }
  },
};
$('#view').addEventListener('click', async e => {
  const el = e.target.closest('[data-cmd]');
  if (!el || !cmds[el.dataset.cmd]) return;
  await engine.ensure();
  await cmds[el.dataset.cmd](+el.dataset.i, el);
  renderPanel(); hooks.changed();
});

document.addEventListener('keydown', e => {
  if (e.code === 'Space' && !/INPUT|TEXTAREA|BUTTON/.test(document.activeElement?.tagName || '')) { e.preventDefault(); engine.toggle(); }
});

device.render(); renderTray(); renderPanel(); checkLesson();

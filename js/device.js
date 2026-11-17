import { KITS, ROWS, COLS, MAX_BEATS } from './kits.js';
import { state, beatCount } from './store.js';

const X0 = 63, Y0 = 122, CW = 63.4, RH = 63.2;
const rowY = r => Y0 + RH * (r + 0.5), colX = c => X0 + CW * (c + 0.5);
const INK = '#4a3327', LINE = '#5b3a24', CREAM = '#f6ecd9', BLUE = '#2f8fb5', ORANGE = '#e8742a', RED = '#d8402f';
export const FX = ['VOL', 'TONO', 'DELAY', 'REVERB'], FX_DISP = ['VOL', 'Pit', 'dLY', 'rEV'];
const KNOB_MODES = ['BPM', 'SWING', 'PASOS'], KNOB_DISP = ['bPM', 'SWG', 'LEn'];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function polar(x, y, r, deg) { const a = deg * Math.PI / 180; return [x + Math.sin(a) * r, y - Math.cos(a) * r]; }
function arc(x, y, r, a0, a1) {
  const [x0, y0] = polar(x, y, r, a0), [x1, y1] = polar(x, y, r, a1);
  return `M${x0.toFixed(1)} ${y0.toFixed(1)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
}
function knob(x, y, r, norm, attrs, title, showArc = true) {
  const a = -135 + clamp(norm, 0, 1) * 270, [px, py] = polar(x, y, r * 0.85, a), [qx, qy] = polar(x, y, r * 0.3, a);
  return `<g ${attrs} class="knob"><title>${title}</title><circle cx="${x}" cy="${y}" r="${r + 9}" fill="transparent"/>
    ${showArc ? `<path d="${arc(x, y, r + 5, -135, 135)}" class="arc-bg"/>${norm > 0.005 ? `<path d="${arc(x, y, r + 5, -135, a)}" class="arc"/>` : ''}` : ''}
    <circle cx="${x}" cy="${y}" r="${r}" fill="${INK}"/><line x1="${qx}" y1="${qy}" x2="${px}" y2="${py}" stroke="${CREAM}" stroke-width="2.2" stroke-linecap="round"/></g>`;
}
function ring(x, y, attrs, title, led, cls = '') {
  return `<g ${attrs} class="btn ${cls}"><title>${title}</title><circle cx="${x}" cy="${y}" r="15" fill="transparent"/>
    <circle cx="${x}" cy="${y}" r="9" fill="${CREAM}" stroke="${LINE}" stroke-width="1.6"/><circle cx="${x}" cy="${y}" r="4.5" fill="${led || INK}"/></g>`;
}
function beat(x, y, v) {
  if (v === 1) return `<circle cx="${x}" cy="${y}" r="21" fill="#4d4039" stroke="#2f2622"/><circle cx="${x}" cy="${y}" r="15" fill="none" stroke="#6a5a50" stroke-width=".8"/>`;
  if (v === 2) return `<circle cx="${x}" cy="${y}" r="20" fill="#c79c6b" stroke="#4d4039" stroke-width="3"/><circle cx="${x}" cy="${y}" r="6" fill="#4d4039"/>`;
  if (v === 3) return `<circle cx="${x + 3}" cy="${y + 4}" r="21" fill="#2a211d"/><circle cx="${x - 2}" cy="${y - 3}" r="21" fill="#4d4039" stroke="#7a695e" stroke-width="1.2"/><circle cx="${x - 2}" cy="${y - 3}" r="15" fill="none" stroke="#6a5a50" stroke-width=".8"/>`;
  return '';
}

export function createDevice(svg, engine, hooks) {
  const ui = { flash: null, col: -1, kitFlash: 0, last: null };
  let drag = null;

  const flash = text => { ui.flash = { text: String(text), until: Date.now() + 1200 }; setTimeout(render, 1250); };
  const chNorm = i => { const c = state.ch[i]; return [c.vol, (c.pitch + 24) / 48, c.delay, c.reverb][state.fxMode]; };
  const dispText = () => ui.flash && ui.flash.until > Date.now() ? ui.flash.text : String([state.bpm, state.swing, state.length][state.knobMode]);

  function build() {
    const s = state, e = engine, kitShow = ui.kitFlash > Date.now();
    let o = `<rect x="8" y="12" width="684" height="580" rx="7" class="body"/>
      <line x1="8" y1="21" x2="692" y2="21" class="ln"/><line x1="8" y1="581" x2="692" y2="581" class="ln"/>
      <text x="62" y="70" class="logo">Tembo</text>
      <text x="80" y="90" class="tiny">STEP SEQUENCER + SAMPLER</text><text x="80" y="98" class="tiny">ESTUDIO VIRTUAL · NO OFICIAL · KIT ${s.kit + 1}: ${KITS[s.kit].name.toUpperCase()}</text>`;
    for (let r = 0; r < 7; r++) for (let c = 0; c < 26 - (r & 1); c++) o += `<circle cx="${394 + c * 7.6 + (r & 1) * 3.8}" cy="${50 + r * 8.5}" r="2" fill="${LINE}"/>`;
    o += knob(622, 75, 15, s.volume, 'data-act="vol"', 'Volumen general', false) + `<text x="622" y="108" class="icon">🔈</text>`;

    // Rejilla 8×5
    o += `<rect x="${X0}" y="${Y0}" width="${CW * COLS}" height="${RH * ROWS}" rx="9" class="grid"/>`;
    if (s.length < COLS) o += `<rect x="${X0 + CW * s.length}" y="${Y0}" width="${CW * (COLS - s.length)}" height="${RH * ROWS}" class="off"/>`;
    if (ui.col >= 0) o += `<rect x="${X0 + CW * ui.col}" y="${Y0}" width="${CW}" height="${RH * ROWS}" class="playcol"/>`;
    for (let c = 1; c < COLS; c++) o += `<line x1="${X0 + CW * c}" y1="${Y0}" x2="${X0 + CW * c}" y2="${Y0 + RH * ROWS}" class="ln"/>`;
    for (let r = 1; r < ROWS; r++) o += `<line x1="${X0}" y1="${Y0 + RH * r}" x2="${X0 + CW * COLS}" y2="${Y0 + RH * r}" class="ln"/>`;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      o += `<g data-act="cell" data-r="${r}" data-c="${c}" class="cell"><rect x="${X0 + CW * c}" y="${Y0 + RH * r}" width="${CW}" height="${RH}" fill="transparent"/>${beat(colX(c), rowY(r), s.grid[r][c])}</g>`;
    }
    // Luces de paso (y de kit al cambiarlo)
    for (let c = 0; c < COLS; c++) {
      const on = kitShow ? c === s.kit : c === ui.col;
      o += `<rect x="${colX(c) - 13}" y="444" width="26" height="8" rx="4" fill="${on ? (kitShow ? BLUE : ORANGE) : CREAM}" stroke="${LINE}" stroke-width="1.2"/>`;
    }
    // Canales: mute (izq.), sample flip (der.), dial de efecto
    o += `<line x1="597" y1="${rowY(0)}" x2="597" y2="446" class="ln"/><line x1="648" y1="${rowY(0)}" x2="648" y2="455" class="ln"/>`;
    for (let r = 0; r < ROWS; r++) {
      const c = s.ch[r], y = rowY(r), recHere = e.micCh === r;
      o += ring(42, y, `data-act="mute" data-i="${r}"`, `Mute canal ${r + 1}`, c.mute ? RED : null);
      o += ring(597, y, `data-act="flip" data-i="${r}"`, `Sample flip canal ${r + 1} (A/B). Con el sampler armado: grabar aquí`, recHere ? RED : c.side ? BLUE : null, e.micArmed && !e.micRec ? 'blink' : '');
      o += knob(648, y, 12, chNorm(r), `data-act="knob" data-i="${r}"`, `${FX[s.fxMode]} canal ${r + 1} (arrastra; clic para escuchar)`);
    }
    // Sampler
    o += `<text x="597" y="462" class="icon">✳</text><circle cx="597" cy="487" r="5" fill="${e.micRec ? RED : INK}"/>
      <g data-act="mic" class="btn ${e.micArmed && !e.micRec ? 'blink' : ''}"><title>Sampler: pulsa y luego elige un canal (columna de botones de arriba) para grabar del micro</title>
      <rect x="584" y="508" width="26" height="42" rx="13" fill="${CREAM}" stroke="${LINE}" stroke-width="1.6"/>
      <rect x="590.5" y="517" width="13" height="24" rx="6.5" fill="${e.micRec || e.micArmed ? ORANGE : CREAM}" stroke="${LINE}" stroke-width="1.6"/></g><text x="597" y="566" class="icon">🎙</text>`;
    // Filtro y selector de efecto
    o += knob(648, 480, 15, (s.filter + 1) / 2, 'data-act="filter"', 'Filtro: izquierda paso bajo, derecha paso alto, centro apagado', false);
    o += `<g data-act="fx" class="btn"><title>Efectos: cambia lo que controlan los diales de canal</title><circle cx="648" cy="538" r="13" fill="${CREAM}" stroke="${LINE}" stroke-width="1.6"/><circle cx="648" cy="538" r="8.5" fill="${INK}"/></g>
      <text x="648" y="566" class="tiny mid">${FX[s.fxMode]}</text>`;
    // Transporte
    o += `<rect x="65" y="487" width="117" height="45" rx="6" fill="none" stroke="${LINE}" stroke-width="1.4"/>`;
    const tb = (x, act, title, inner) => `<g data-act="${act}" class="btn"><title>${title}</title><rect x="${x - 14}" y="495" width="28" height="29" rx="5" fill="${CREAM}" stroke="${LINE}" stroke-width="1.6"/>${inner}</g>`;
    o += tb(87, 'play', 'Play / Pausa (espacio)', `<circle cx="87" cy="509.5" r="9" fill="${e.playing ? BLUE : INK}"/>${e.playing ? `<rect x="83.5" y="505.5" width="2.6" height="8" fill="${CREAM}"/><rect x="88" y="505.5" width="2.6" height="8" fill="${CREAM}"/>` : `<path d="M84.5 505 L92 509.5 L84.5 514Z" fill="${CREAM}"/>`}`);
    o += tb(123, 'rec', 'Grabar sesión (descarga un archivo de audio al parar)', `<circle cx="123" cy="509.5" r="9" fill="${e.sessionRec ? RED : CREAM}" stroke="${LINE}" stroke-width="1.5"/><circle cx="123" cy="509.5" r="3.5" fill="${e.sessionRec ? CREAM : RED}"/>`);
    o += tb(159, 'kit', 'Selector de kit (clic: siguiente; Mayús+clic: anterior)', `<circle cx="159" cy="509.5" r="10" fill="${INK}"/><text x="159" y="513" class="kitn">${s.kit + 1}</text>`);
    o += `<g data-act="display" class="btn"><title>Pantalla: clic para cambiar entre BPM, swing y pasos</title><rect x="196" y="493" width="60" height="32" rx="4" fill="#33241b" stroke="${LINE}"/><text x="226" y="517" class="seg">${dispText()}</text></g>
      <text x="226" y="537" class="tiny mid">${KNOB_MODES[s.knobMode]}</text>`;
    // Dial grande y loops
    for (let k = 0; k < 7; k++) { const [a, b] = polar(478, 495, 33, -75 + k * 25), [c2, d] = polar(478, 495, 38, -75 + k * 25); o += `<line x1="${a}" y1="${b}" x2="${c2}" y2="${d}" class="ln"/>`; }
    o += knob(478, 495, 26, [(s.bpm - 40) / 200, s.swing / 100, (s.length - 1) / 7][s.knobMode], 'data-act="tempo"', 'Dial principal: arrastra para ajustar; clic para cambiar BPM / swing / pasos', false);
    for (let i = 0; i < 4; i++) {
      const x = 424 + i * 35.6;
      o += `<g data-act="loop" data-i="${i}" class="btn"><title>Loop ${i + 1}: ${engine.loopSlots[i] ? 'Resample' : KITS[s.kit].loops.parts[i].name}</title><circle cx="${x}" cy="540" r="11.5" fill="${CREAM}" stroke="${LINE}" stroke-width="1.6"/><circle cx="${x}" cy="540" r="7" fill="${s.loops[i] ? ORANGE : CREAM}" stroke="${LINE}" stroke-width="1.4"/></g>`;
    }
    o += `<text x="477" y="570" class="icon">⟲</text>`;
    return o;
  }

  // Dos capas: la visual se redibuja entera; la de zonas táctiles es fija, para que el elemento
  // que recibe el dedo o el ratón nunca desaparezca a mitad de un gesto.
  function hits() {
    const h = (shape, act, title, extra = '', cls = 'btn') => `<${shape} data-act="${act}" ${extra} class="hit ${cls}"><title>${title}</title></${shape.split(' ')[0]}>`;
    const circ = (x, y, r) => `circle cx="${x}" cy="${y}" r="${r}"`, rect = (x, y, w, hh) => `rect x="${x}" y="${y}" width="${w}" height="${hh}"`;
    let o = '';
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) o += h(rect(X0 + CW * c, Y0 + RH * r, CW, RH), 'cell', 'Colocar o quitar un Beat', `data-r="${r}" data-c="${c}"`, 'cellhit');
    for (let r = 0; r < ROWS; r++) {
      o += h(circ(42, rowY(r), 17), 'mute', `Mute canal ${r + 1}`, `data-i="${r}"`);
      o += h(circ(597, rowY(r), 17), 'flip', `Sample A/B canal ${r + 1}. Con el sampler armado: grabar aquí`, `data-i="${r}"`);
      o += h(circ(648, rowY(r), 24), 'knob', `Dial del canal ${r + 1}: arrastra arriba/abajo o a los lados; clic para escuchar`, `data-i="${r}"`, 'knob');
    }
    o += h(circ(622, 75, 26), 'vol', 'Volumen general', '', 'knob');
    o += h(circ(648, 480, 24), 'filter', 'Filtro: izquierda paso bajo, derecha paso alto, centro apagado', '', 'knob');
    o += h(circ(478, 495, 40), 'tempo', 'Dial principal: arrastra para ajustar; clic para cambiar BPM / swing / pasos', '', 'knob');
    o += h(circ(648, 538, 16), 'fx', 'Efectos: cambia lo que controlan los diales de canal');
    o += h(rect(580, 504, 34, 50), 'mic', 'Sampler: pulsa y luego el botón de un canal para grabar del micro');
    o += h(rect(70, 492, 34, 35), 'play', 'Play / Pausa (espacio)') + h(rect(106, 492, 34, 35), 'rec', 'Grabar sesión') + h(rect(142, 492, 34, 35), 'kit', 'Selector de kit (Mayús+clic: anterior)');
    o += h(rect(196, 493, 60, 32), 'display', 'Pantalla: clic para cambiar entre BPM, swing y pasos');
    for (let i = 0; i < 4; i++) o += h(circ(424 + i * 35.6, 540, 15), 'loop', `Loop ${i + 1}`, `data-i="${i}"`);
    return o;
  }
  svg.innerHTML = `<g id="vis" pointer-events="none"></g><g id="hits">${hits()}</g>`;
  const vis = svg.querySelector('#vis');
  function render() { vis.innerHTML = build(); }

  const startVal = (act, i) => act === 'knob' ? [state.ch[i].vol, state.ch[i].pitch, state.ch[i].delay, state.ch[i].reverb][state.fxMode]
    : act === 'filter' ? state.filter : act === 'vol' ? state.volume : act === 'tempo' ? [state.bpm, state.swing, state.length][state.knobMode] : null;

  function setVal(act, i, v0, dy) {
    if (act === 'knob') {
      const c = state.ch[i], m = state.fxMode;
      if (m === 1) { c.pitch = clamp(Math.round(v0 + dy / 5), -24, 24); flash(c.pitch); }
      else { const v = clamp(v0 + dy / 160, 0, 1); c[['vol', '', 'delay', 'reverb'][m]] = v; flash(Math.round(v * 100)); }
    } else if (act === 'filter') { let v = clamp(v0 + dy / 110, -1, 1); if (Math.abs(v) < 0.06) v = 0; state.filter = v; flash(v === 0 ? 'OFF' : (v < 0 ? 'L' : 'H') + Math.round(Math.abs(v) * 99)); }
    else if (act === 'vol') { state.volume = clamp(v0 + dy / 160, 0, 1); flash(Math.round(state.volume * 100)); }
    else if (act === 'tempo') {
      if (state.knobMode === 0) state.bpm = clamp(Math.round(v0 + dy / 2), 40, 240);
      else if (state.knobMode === 1) state.swing = clamp(Math.round(v0 + dy / 2), 0, 100);
      else state.length = clamp(Math.round(v0 + dy / 14), 1, 8);
      ui.flash = null;
    }
    engine.apply(); hooks.changed();
  }

  function resetVal(act, i) {
    if (act === 'knob') state.ch[i][['vol', 'pitch', 'delay', 'reverb'][state.fxMode]] = state.fxMode === 0 ? 0.8 : 0;
    else if (act === 'filter') state.filter = 0;
    else if (act === 'vol') state.volume = 0.8;
    flash('rST'); engine.apply(); hooks.changed();
  }

  async function click(d, ev) {
    const audio = engine.ensure().catch(err => console.warn('Audio no disponible', err));
    if (d.act !== 'cell') await audio; // colocar Beats nunca espera al audio
    const s = state, { act, i } = d, now = Date.now();
    const dbl = ui.last && ui.last.act === act && ui.last.i === i && now - ui.last.t < 350;
    ui.last = { act, i, t: now };
    if (act === 'cell') {
      const cur = s.grid[d.r][d.c];
      let next = d.btn === 2 || cur === s.tool ? 0 : s.tool;
      const g2 = s.grid.map(r => [...r]); g2[d.r][d.c] = next;
      if (beatCount(g2) > MAX_BEATS) { flash('30'); hooks.toast(`Solo hay ${MAX_BEATS} Beats en la caja. Quita alguno para colocar más.`); return; }
      s.grid = g2;
      if (next && !engine.playing) audio.then(() => engine.trigger(d.r));
      engine.apply(); hooks.changed(); return;
    } else if (act === 'mute') s.ch[i].mute = !s.ch[i].mute;
    else if (act === 'flip') {
      if (engine.micRec) { engine.micStop(); return; }
      if (engine.micArmed) { try { await engine.micStart(i); } catch { engine.micArmed = false; hooks.toast('No se pudo acceder al micrófono.'); } }
      else { s.ch[i].side ^= 1; engine.trigger(i); flash(s.ch[i].side ? 'b' : 'A'); }
    } else if (act === 'mic') { if (engine.micRec) engine.micStop(); else engine.micArmed = !engine.micArmed; }
    else if (act === 'play') { await engine.toggle(); }
    else if (act === 'rec') await engine.toggleSession();
    else if (act === 'kit') await hooks.setKit((s.kit + (ev.shiftKey ? 7 : 1)) % 8);
    else if (act === 'display' || act === 'tempo') { s.knobMode = (s.knobMode + 1) % 3; flash(KNOB_DISP[s.knobMode]); }
    else if (act === 'loop') s.loops[i] = !s.loops[i];
    else if (act === 'fx') { s.fxMode = (s.fxMode + 1) % 4; flash(FX_DISP[s.fxMode]); }
    else if (act === 'knob') { if (dbl) return resetVal(act, i); engine.trigger(i); }
    else if (act === 'filter' || act === 'vol') { if (dbl) return resetVal(act, i); }
    engine.apply(); hooks.changed();
  }

  const onMove = e => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = (e.clientX - drag.x) + (drag.y - e.clientY); // arriba o a la derecha = más
    if (drag.v0 === null) return;
    if (Math.abs(d) > 4) drag.moved = true;
    if (drag.moved) setVal(drag.act, drag.i, drag.v0, d);
  };
  const onUp = e => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onUp);
    if (e.type === 'pointerup' && !d.moved) click(d, e);
  };
  svg.addEventListener('pointerdown', e => {
    const el = e.target.closest('[data-act]');
    if (!el || drag) return;
    e.preventDefault();
    const act = el.dataset.act, i = +el.dataset.i || 0;
    drag = { id: e.pointerId, act, i, r: +el.dataset.r, c: +el.dataset.c, x: e.clientX, y: e.clientY, moved: false, v0: startVal(act, i), btn: e.button };
    try { el.setPointerCapture(e.pointerId); } catch { /* sin captura: bastan los listeners de window */ }
    window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp); window.addEventListener('pointercancel', onUp);
  });
  svg.addEventListener('contextmenu', e => e.preventDefault());
  svg.addEventListener('wheel', e => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act, i = +el.dataset.i || 0, v0 = startVal(act, i);
    if (v0 === null) return;
    e.preventDefault(); setVal(act, i, v0, -Math.sign(e.deltaY) * (act === 'tempo' && state.knobMode === 2 ? 14 : 6));
  }, { passive: false });

  (function frame() {
    const col = engine.ctx ? engine.playCol() : -1;
    if (col !== ui.col) { ui.col = col; render(); }
    requestAnimationFrame(frame);
  })();

  return { render, flash, showKit() { ui.kitFlash = Date.now() + 1300; flash('K ' + (state.kit + 1)); render(); } };
}


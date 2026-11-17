import { KITS, ROWS, COLS, MAX_BEATS } from './kits.js';
import { state, beatCount } from './store.js';

// Disposición según el diagrama oficial del modelo A-001 (lienzo 700×600).
const X0 = 63, Y0 = 122, CW = 63.4, RH = 63.2;
const rowY = r => Y0 + RH * (r + 0.5), colX = c => X0 + CW * (c + 0.5);
const LINE = '#6b4a30', INK = '#3d2c22', TAN = '#b99c82', TAN_D = '#8f755e', WHITE = '#f4f0e9', GREEN = '#2f5d4a', RED = '#d8402f', AMBER = '#f0a030';
export const FX = ['DELAY', 'REVERB', 'TONO', 'GATE', 'FILTRO'];
const FX_DISP = ['dLY', 'rEV', 'Pit', 'GAt', 'FLt'];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function polar(x, y, r, deg) { const a = deg * Math.PI / 180; return [x + Math.sin(a) * r, y - Math.cos(a) * r]; }
function arc(x, y, r, a0, a1) {
  const [x0, y0] = polar(x, y, r, a0), [x1, y1] = polar(x, y, r, a1);
  return `M${x0.toFixed(1)} ${y0.toFixed(1)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
}
// Dial cilíndrico color arena, como los del A-001.
function knob(x, y, r, norm, ringed) {
  const a = -135 + clamp(norm, 0, 1) * 270, [px, py] = polar(x, y, r * 0.9, a), [qx, qy] = polar(x, y, r * 0.35, a);
  return `${ringed ? `<circle cx="${x}" cy="${y}" r="${r + 5}" fill="${WHITE}" stroke="${LINE}" stroke-width="1"/>${norm > 0.005 ? `<path d="${arc(x, y, r + 5, -135, a)}" class="arc"/>` : ''}` : ''}
    <circle cx="${x + 1.5}" cy="${y + 2.5}" r="${r}" fill="rgba(60,40,25,.28)"/><circle cx="${x}" cy="${y}" r="${r}" fill="${TAN}" stroke="${TAN_D}" stroke-width="1.2"/>
    <circle cx="${x}" cy="${y}" r="${r * 0.72}" fill="#c6ab92"/><line x1="${qx}" y1="${qy}" x2="${px}" y2="${py}" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`;
}
function button(x, y, fill, cls = '') {
  return `<g class="${cls}"><circle cx="${x}" cy="${y}" r="10.5" fill="none" stroke="${LINE}" stroke-width="1.2"/><circle cx="${x}" cy="${y}" r="7.5" fill="${fill}" stroke="#b9aa98" stroke-width="1"/></g>`;
}
function beat(x, y, v) {
  const disc = (cx, cy) => `<circle cx="${cx}" cy="${cy}" r="21" fill="#8b6446" stroke="#6a4a33" stroke-width="1.2"/><circle cx="${cx}" cy="${cy}" r="16" fill="none" stroke="#7a5639" stroke-width=".8"/><circle cx="${cx}" cy="${cy}" r="9" fill="none" stroke="#7a5639" stroke-width=".6"/>`;
  const shadow = (cx, cy) => `<circle cx="${cx + 3}" cy="${cy + 5}" r="21" fill="rgba(60,40,25,.3)"/>`;
  if (v === 1) return shadow(x, y) + disc(x, y);
  if (v === 2) return shadow(x, y) + `<circle cx="${x}" cy="${y}" r="21" fill="#d0ad84" stroke="#6a4a33" stroke-width="2.5"/><circle cx="${x}" cy="${y}" r="6.5" fill="#5a4030"/>`;
  if (v === 3) return shadow(x + 2, y + 3) + `<circle cx="${x + 3}" cy="${y + 4}" r="21" fill="#6a4a33"/>` + disc(x - 2, y - 3);
  return '';
}

export function createDevice(svg, engine, hooks) {
  const ui = { flash: null, col: -1, kitFlash: 0, last: null, shiftLatch: false, shiftKey: false, held: new Set(), keyHeld: new Set(), holdUsed: new Set() };
  const drags = new Map();
  const shift = () => ui.shiftLatch || ui.shiftKey;
  const heldChs = () => [...new Set([...ui.held, ...ui.keyHeld])];

  const flash = text => { ui.flash = { text: String(text), until: Date.now() + 1200 }; setTimeout(render, 1250); };
  const dispText = () => ui.flash && ui.flash.until > Date.now() ? ui.flash.text : String(state.bpm);

  function build() {
    const s = state, e = engine, kitShow = ui.kitFlash > Date.now();
    let o = `<rect x="8" y="12" width="684" height="580" rx="7" class="body"/>
      <line x1="8" y1="21" x2="692" y2="21" class="ln"/><line x1="8" y1="581" x2="692" y2="581" class="ln"/>
      <text x="62" y="70" class="logo">timbou</text>
      <text x="80" y="90" class="tiny">STEP SEQUENCER + SAMPLER</text><text x="80" y="98" class="tiny">KIT ${s.kit + 1} · ${KITS[s.kit].name.toUpperCase()}</text>`;
    for (let r = 0; r < 7; r++) for (let c = 0; c < 26 - (r & 1); c++) o += `<circle cx="${394 + c * 7.6 + (r & 1) * 3.8}" cy="${50 + r * 8.5}" r="2" fill="${LINE}"/>`;
    o += knob(622, 75, 15, s.volume) + `<text x="622" y="108" class="icon">🔈</text>`;

    // Rejilla 8×5 con columnas alternas, como la chapa del original
    o += `<clipPath id="gclip"><rect x="${X0}" y="${Y0}" width="${CW * COLS}" height="${RH * ROWS}" rx="9"/></clipPath><g clip-path="url(#gclip)">`;
    for (let c = 0; c < COLS; c++) o += `<rect x="${X0 + CW * c}" y="${Y0}" width="${CW}" height="${RH * ROWS}" fill="${c & 1 ? '#e6c999' : '#d6ad77'}"/>`;
    if (s.length < COLS) o += `<rect x="${X0 + CW * s.length}" y="${Y0}" width="${CW * (COLS - s.length)}" height="${RH * ROWS}" class="off"/>`;
    if (ui.col >= 0) o += `<rect x="${X0 + CW * ui.col}" y="${Y0}" width="${CW}" height="${RH * ROWS}" class="playcol"/>`;
    o += '</g>';
    for (let c = 1; c < COLS; c++) o += `<line x1="${X0 + CW * c}" y1="${Y0}" x2="${X0 + CW * c}" y2="${Y0 + RH * ROWS}" class="ln thin"/>`;
    for (let r = 1; r < ROWS; r++) o += `<line x1="${X0}" y1="${Y0 + RH * r}" x2="${X0 + CW * COLS}" y2="${Y0 + RH * r}" class="ln thin"/>`;
    o += `<rect x="${X0}" y="${Y0}" width="${CW * COLS}" height="${RH * ROWS}" rx="9" fill="none" stroke="${LINE}" stroke-width="1.4"/>`;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) o += beat(colX(c), rowY(r), s.grid[r][c]);
    // Indicadores de paso (muestran el kit un momento al cambiarlo)
    for (let c = 0; c < COLS; c++) {
      const on = kitShow ? c === s.kit : c === ui.col;
      o += `<rect x="${colX(c) - 13}" y="444" width="26" height="8" rx="4" fill="${on ? '#fff' : '#d9cdbd'}" stroke="${on ? AMBER : '#b9aa98'}" stroke-width="${on ? 2 : 1}"/>`;
    }
    // Canal: on/off (izq.), sample assign/flip y dial de FX (der.)
    o += `<path d="M597 ${rowY(0)}V446" class="ln"/><path d="M648 ${rowY(0)}V462" class="ln"/>`;
    const held = heldChs();
    for (let r = 0; r < ROWS; r++) {
      const c = s.ch[r], y = rowY(r);
      o += button(42, y, c.mute ? '#6b5a4d' : held.includes(r) ? AMBER : WHITE);
      o += button(597, y, e.micCh === r ? RED : c.side ? AMBER : WHITE, e.micArmed && !e.micRec ? 'blink' : '');
      o += knob(648, y, 11, c.fx, true);
    }
    // Micro integrado y sampler
    o += `<text x="597" y="462" class="icon">✳</text><circle cx="597" cy="487" r="5" fill="${e.micRec ? RED : '#a3352a'}" stroke="${LINE}" stroke-width="1"/>
      <g class="${e.micArmed && !e.micRec ? 'blink' : ''}"><rect x="584" y="508" width="26" height="42" rx="13" fill="none" stroke="${LINE}" stroke-width="1.3"/>
      <rect x="589.5" y="515" width="15" height="28" rx="7.5" fill="${e.micRec || e.micArmed ? AMBER : WHITE}" stroke="#b9aa98"/></g><text x="597" y="566" class="icon">🎙</text>`;
    // Selector de FX (dial de pico) y cantidad global
    for (let k = 0; k < 5; k++) { const [a, b] = polar(648, 482, 21, -60 + k * 30), [c2, d] = polar(648, 482, 25, -60 + k * 30); o += `<line x1="${a}" y1="${b}" x2="${c2}" y2="${d}" class="ln${k === s.fxSel ? ' tickon' : ''}"/>`; }
    o += `<g transform="rotate(${-60 + s.fxSel * 30} 648 482)"><path d="M638.5 487 L648 464 L657.5 487Z" fill="${TAN}" stroke="${TAN_D}" stroke-width="1.2" stroke-linejoin="round"/><circle cx="648" cy="484" r="10.5" fill="${TAN}" stroke="${TAN_D}" stroke-width="1.2"/><circle cx="648" cy="484" r="6.5" fill="#c6ab92"/></g>
      <text x="648" y="513" class="tiny mid">${FX[s.fxSel]}</text>`;
    o += knob(648, 538, 12, s.fxAmt) + `<text x="648" y="566" class="icon">〰</text>`;
    // Transporte: play/stop, grabar sesión, dial BPM/swing
    o += `<rect x="65" y="487" width="117" height="45" rx="6" fill="none" stroke="${LINE}" stroke-width="1.3"/>
      <rect x="71" y="494" width="32" height="31" rx="5" fill="${GREEN}" stroke="#1f4435"/>${e.playing ? `<rect x="81.5" y="503" width="4" height="13" fill="#fff"/><rect x="88.5" y="503" width="4" height="13" fill="#fff"/>` : `<path d="M82 502 L94 509.5 L82 517Z" fill="#fff"/>`}
      <rect x="107" y="494" width="32" height="31" rx="5" fill="${e.sessionRec ? RED : '#c9b29c'}" stroke="${TAN_D}"/><circle cx="123" cy="509.5" r="${e.sessionRec ? 6 : 3.5}" fill="${e.sessionRec ? '#fff' : RED}"/>
      <rect x="143" y="494" width="32" height="31" rx="5" fill="#c9b29c" stroke="${TAN_D}"/>` + knob(159, 509.5, 9.5, shift() ? s.swing / 100 : (s.bpm - 40) / 200);
    o += `<rect x="196" y="493" width="60" height="32" rx="4" fill="#a98c72" stroke="${TAN_D}"/><text x="226" y="517" class="seg">${dispText()}</text>
      <text x="226" y="537" class="tiny mid">${shift() ? 'SHIFT: SWING · PASOS' : 'BPM'}</text>`;
    // Selector de kit y loops
    for (let k = 0; k < 8; k++) { const [a, b] = polar(478, 495, 33, -105 + k * 30), [c2, d] = polar(478, 495, 38, -105 + k * 30); o += `<line x1="${a}" y1="${b}" x2="${c2}" y2="${d}" class="ln${!shift() && k === s.kit ? ' tickon' : ''}"/>`; }
    const kn = shift() ? (s.length - 1) / 7 : s.kit / 7;
    o += knob(478, 495, 26, (kn * 210 + 30) / 270);
    for (let i = 0; i < 4; i++) o += button(424 + i * 35.6, 540, s.loops[i] ? AMBER : WHITE);
    o += `<text x="477" y="570" class="icon">⟲</text>`;
    // Botón shift en el lateral izquierdo
    o += `<rect x="1" y="500" width="11" height="30" rx="3" fill="${shift() ? AMBER : TAN}" stroke="${TAN_D}"/><text x="27" y="519" class="tiny mid">${shift() ? 'SHIFT' : ''}</text>`;
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
      o += h(circ(42, rowY(r), 17), 'mute', `Canal ${r + 1} on/off. Mantenlo (o la tecla ${r + 1}) y gira Volumen para el volumen del canal; también puedes arrastrar aquí`, `data-i="${r}"`);
      o += h(circ(597, rowY(r), 17), 'flip', `Sample assign/flip del canal ${r + 1}: alterna A/B. Con el sampler armado, graba aquí`, `data-i="${r}"`);
      o += h(circ(648, rowY(r), 24), 'knob', `FX dry-wet del canal ${r + 1}: arrastra; clic para escuchar`, `data-i="${r}"`, 'knob');
    }
    o += h(circ(622, 75, 26), 'vol', 'Volumen. Con un canal mantenido: volumen de ese canal', '', 'knob');
    o += h(circ(648, 482, 23), 'fxsel', 'Selector de FX: delay, reverb, tono, gate, filtro', '', 'knob');
    o += h(circ(648, 538, 20), 'fxamt', 'Cantidad global de FX', '', 'knob');
    o += h(circ(478, 495, 40), 'kit', 'Selector de kit. Con shift: número de pasos', '', 'knob');
    o += h(rect(580, 504, 34, 50), 'mic', 'Sampler: pulsa y luego el botón de un canal para grabar del micro');
    o += h(rect(69, 492, 36, 35), 'play', 'Play / Stop (espacio)') + h(rect(105, 492, 36, 35), 'rec', 'Grabar sesión') + h(rect(141, 489, 40, 41), 'bpm', 'BPM. Con shift: swing', '', 'knob');
    for (let i = 0; i < 4; i++) o += h(circ(424 + i * 35.6, 540, 15), 'loop', `Loop ${i + 1} on/off`, `data-i="${i}"`);
    o += h(rect(0, 492, 40, 46), 'shift', 'Shift (clic para fijarlo, o mantén la tecla Mayús)');
    return o;
  }
  svg.innerHTML = `<g id="vis" pointer-events="none"></g><g id="hits">${hits()}</g>`;
  const vis = svg.querySelector('#vis');
  function render() { vis.innerHTML = build(); }

  const startVal = (act, i, sh, chs) => ({
    knob: () => state.ch[i].fx, mute: () => state.ch[i].vol,
    vol: () => chs.length ? chs.map(c => state.ch[c].vol) : state.volume,
    fxsel: () => state.fxSel, fxamt: () => state.fxAmt,
    kit: () => sh ? state.length : state.kit, bpm: () => sh ? state.swing : state.bpm,
  }[act]?.() ?? null);

  function setVal(d, delta) {
    const { act, i, v0 } = d, pct = v => Math.round(v * 100);
    if (act === 'knob') { state.ch[i].fx = clamp(v0 + delta / 160, 0, 1); flash(state.fxSel === 2 ? engine.pitchOf(i) : pct(state.ch[i].fx)); }
    else if (act === 'mute') { state.ch[i].vol = clamp(v0 + delta / 160, 0, 1); flash(pct(state.ch[i].vol)); }
    else if (act === 'vol') {
      if (d.chs.length) { d.chs.forEach((c, k) => { state.ch[c].vol = clamp(v0[k] + delta / 160, 0, 1); ui.holdUsed.add(c); }); flash(pct(state.ch[d.chs[0]].vol)); }
      else { state.volume = clamp(v0 + delta / 160, 0, 1); flash(pct(state.volume)); }
    } else if (act === 'fxsel') { state.fxSel = clamp(Math.round(v0 + delta / 28), 0, 4); flash(FX_DISP[state.fxSel]); }
    else if (act === 'fxamt') { state.fxAmt = clamp(v0 + delta / 160, 0, 1); flash(state.fxSel === 2 ? Math.round((state.fxAmt - 0.5) * 48) : pct(state.fxAmt)); }
    else if (act === 'kit') {
      if (d.sh) { state.length = clamp(Math.round(v0 + delta / 24), 1, 8); flash('L ' + state.length); }
      else { const k = clamp(Math.round(v0 + delta / 26), 0, 7); if (k !== state.kit) hooks.setKit(k); return; }
    } else if (act === 'bpm') {
      if (d.sh) { state.swing = clamp(Math.round(v0 + delta / 2), 0, 100); flash('S' + String(state.swing).padStart(2, '0')); }
      else { state.bpm = clamp(Math.round(v0 + delta / 2), 40, 240); ui.flash = null; }
    }
    engine.apply(); hooks.changed();
  }

  function reset(act, i) {
    if (act === 'knob') state.ch[i].fx = 0;
    else if (act === 'fxamt') state.fxAmt = 0.5;
    else if (act === 'vol') state.volume = 0.8;
    else if (act === 'bpm') state.bpm = KITS[state.kit].bpm;
    else return false;
    flash('rST'); engine.apply(); hooks.changed();
    return true;
  }

  async function click(d) {
    const audio = engine.ensure().catch(err => console.warn('Audio no disponible', err));
    if (d.act !== 'cell') await audio; // colocar Beats nunca espera al audio
    const s = state, { act, i } = d, now = Date.now();
    const dbl = ui.last && ui.last.act === act && ui.last.i === i && now - ui.last.t < 350;
    ui.last = { act, i, t: now };
    if (dbl && reset(act, i)) return;
    if (act === 'cell') {
      const cur = s.grid[d.r][d.c], next = d.btn === 2 || cur === s.tool ? 0 : s.tool;
      const g2 = s.grid.map(r => [...r]); g2[d.r][d.c] = next;
      if (beatCount(g2) > MAX_BEATS) { flash('30'); hooks.toast(`Solo hay ${MAX_BEATS} Beats en la caja. Quita alguno para colocar más.`); return; }
      s.grid = g2;
      if (next && !engine.playing) audio.then(() => engine.trigger(d.r));
    } else if (act === 'mute') { if (ui.holdUsed.delete(i)) return; s.ch[i].mute = !s.ch[i].mute; }
    else if (act === 'flip') {
      if (engine.micRec) { engine.micStop(); return; }
      if (engine.micArmed) { try { await engine.micStart(i); } catch { engine.micArmed = false; hooks.toast('No se pudo acceder al micrófono.'); } }
      else { s.ch[i].side ^= 1; engine.trigger(i); flash(s.ch[i].side ? 'b' : 'A'); }
    } else if (act === 'mic') { if (engine.micRec) engine.micStop(); else engine.micArmed = !engine.micArmed; }
    else if (act === 'play') { await engine.toggle(); if (engine.broken) hooks.toast('Este navegador no deja iniciar el audio.'); }
    else if (act === 'rec') await engine.toggleSession();
    else if (act === 'loop') s.loops[i] = !s.loops[i];
    else if (act === 'shift') ui.shiftLatch = !ui.shiftLatch;
    else if (act === 'knob') engine.trigger(i);
    else if (act === 'fxsel') { s.fxSel = (s.fxSel + 1) % 5; flash(FX_DISP[s.fxSel]); }
    else if (act === 'kit' && !d.sh) { await hooks.setKit((s.kit + 1) % 8); return; }
    engine.apply(); hooks.changed();
  }

  const onMove = e => {
    const d = drags.get(e.pointerId);
    if (!d || d.v0 === null) return;
    const delta = (e.clientX - d.x) + (d.y - e.clientY); // arriba o a la derecha = más
    if (Math.abs(delta) > 4) d.moved = true;
    if (d.moved) setVal(d, delta);
  };
  const onUp = e => {
    const d = drags.get(e.pointerId);
    if (!d) return;
    drags.delete(e.pointerId);
    if (d.act === 'mute') { ui.held.delete(d.i); render(); }
    if (e.type === 'pointerup' && !d.moved) click(d); else if (d.act === 'mute') ui.holdUsed.delete(d.i);
  };
  window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp); window.addEventListener('pointercancel', onUp);
  svg.addEventListener('pointerdown', e => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    e.preventDefault();
    const act = el.dataset.act, i = +el.dataset.i || 0, sh = shift(), chs = heldChs();
    drags.set(e.pointerId, { act, i, sh, chs, r: +el.dataset.r, c: +el.dataset.c, x: e.clientX, y: e.clientY, moved: false, v0: startVal(act, i, sh, chs), btn: e.button });
    if (act === 'mute') { ui.held.add(i); render(); }
    try { el.setPointerCapture(e.pointerId); } catch { /* sin captura: bastan los listeners de window */ }
  });
  svg.addEventListener('contextmenu', e => e.preventDefault());
  svg.addEventListener('wheel', e => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act, i = +el.dataset.i || 0, sh = shift(), chs = heldChs(), v0 = startVal(act, i, sh, chs);
    if (v0 === null) return;
    e.preventDefault();
    const stepped = act === 'kit' || act === 'fxsel';
    setVal({ act, i, sh, chs, v0 }, -Math.sign(e.deltaY) * (stepped ? 28 : 6));
  }, { passive: false });

  // Teclado: Mayús = shift; 1–5 mantenidas = «mantener» el botón de ese canal.
  const typing = () => /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '');
  document.addEventListener('keydown', e => {
    if (e.key === 'Shift' && !ui.shiftKey) { ui.shiftKey = true; render(); }
    if (!typing() && e.key >= '1' && e.key <= '5' && !ui.keyHeld.has(+e.key - 1)) { ui.keyHeld.add(+e.key - 1); render(); }
  });
  document.addEventListener('keyup', e => {
    if (e.key === 'Shift') { ui.shiftKey = false; render(); }
    if (e.code.startsWith('Digit') && ui.keyHeld.delete(+e.code.slice(5) - 1)) { ui.holdUsed.delete(+e.code.slice(5) - 1); render(); }
  });
  window.addEventListener('blur', () => { ui.shiftKey = false; ui.keyHeld.clear(); ui.held.clear(); render(); });

  (function frame() {
    const col = engine.ctx ? engine.playCol() : -1;
    if (col !== ui.col) { ui.col = col; render(); }
    requestAnimationFrame(frame);
  })();

  return { render, flash, showKit() { ui.kitFlash = Date.now() + 1300; flash('K ' + (state.kit + 1)); render(); } };
}

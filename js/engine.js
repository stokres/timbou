import { SR, synth, tidy } from './dsp.js';
import { KITS, ROWS, degToMidi } from './kits.js';
import { state, idb } from './store.js';

const TIMBRES = {
  sub: { w: [['sine', 1, 0.9]], cut: 900 },
  saw: { w: [['sawtooth', 1, 0.45], ['square', 0.5, 0.3]], cut: 500, fenv: 1600 },
  sq: { w: [['square', 1, 0.4]], cut: 600, fenv: 900 },
  pad: { w: [['sawtooth', 1, 0.16, -9], ['sawtooth', 1, 0.16, 9]], cut: 1300, atk: 0.08, rel: 0.35 },
  organ: { w: [['sine', 1, 0.3], ['sine', 2, 0.18], ['sine', 3, 0.08]], cut: 5000 },
  ep: { w: [['sine', 1, 0.4], ['triangle', 2, 0.1], ['sine', 4, 0.05]], cut: 3000, perc: 0.5 },
  pluck: { w: [['triangle', 1, 0.4], ['square', 1, 0.08]], cut: 2500, perc: 0.16 },
  bell: { w: [['sine', 1, 0.35], ['sine', 3.01, 0.12]], cut: 8000, perc: 0.45 },
  stab: { w: [['sawtooth', 1, 0.2], ['sawtooth', 1.006, 0.2]], cut: 1800, perc: 0.14 },
};

const sampleKey = (kit, ch, side) => `s:${KITS[kit].id}:${ch}:${side}`;

export class Engine {
  constructor() {
    this.ctx = null; this.playing = false; this.tick = 0; this.marks = [];
    this.buf = []; this.names = []; this.custom = []; // [canal][lado]
    this.loopSlots = [null, null, null, null];
    this.micArmed = false; this.micRec = null; this.micCh = -1;
    this.sessionRec = null; this.override = null; this.onChange = () => {};
  }

  // Arranca el audio sin bloquear nunca la interfaz: si algo falla, la app sigue funcionando en silencio.
  async ensure() {
    if (this.broken) return;
    if (!this.ctx) {
      try { this.build(); } catch (err) { console.warn('Audio no disponible', err); this.ctx = null; this.broken = true; return; }
      this.ready = this.loadKit(state.kit).catch(err => console.warn('No se pudo cargar el kit', err));
    }
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {}); // sin await: en algunos navegadores no resuelve
    await this.ready;
  }

  build() {
    const c = this.ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    const G = v => { const g = c.createGain(); g.gain.value = v; return g; };
    const F = type => { const f = c.createBiquadFilter(); f.type = type; f.Q.value = 2.5; return f; };
    this.master = G(0.6);
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 12; comp.attack.value = 0.003; comp.release.value = 0.12;
    this.out = G(0.8);
    this.master.connect(comp).connect(this.out);
    this.out.connect(c.destination);
    try { this.recDest = c.createMediaStreamDestination(); this.out.connect(this.recDest); } catch { this.recDest = null; }

    this.delayIn = G(1); this.delay = c.createDelay(2);
    this.fb = G(0.42);
    const fbLp = F('lowpass'); fbLp.Q.value = 0.7; fbLp.frequency.value = 3000;
    this.delayIn.connect(this.delay); this.delay.connect(fbLp).connect(this.fb).connect(this.delay);
    this.delay.connect(G(0.8)).connect(this.master);

    this.revIn = G(1); this.conv = c.createConvolver();
    this.setReverb(1.2);
    this.revIn.connect(this.conv).connect(G(0.7)).connect(this.master);

    // Por canal: entrada -> (seco | filtro) -> volumen -> master y envíos a delay/reverb.
    this.ch = Array.from({ length: ROWS }, () => {
      const inp = G(1), dry = G(1), lp = F('lowpass'), hp = F('highpass'), wet = G(0), gain = G(0.6), dly = G(0), rev = G(0);
      inp.connect(dry).connect(gain); inp.connect(lp).connect(hp).connect(wet).connect(gain);
      gain.connect(this.master); gain.connect(dly).connect(this.delayIn); gain.connect(rev).connect(this.revIn);
      return { inp, dry, lp, hp, wet, gain, dly, rev };
    });
    this.loopBus = G(0.6); this.loopBus.connect(this.master);
    this.loopBus.connect(G(0.15)).connect(this.revIn);
    this.apply();
  }

  setReverb(decay) {
    const rate = this.ctx.sampleRate, ir = this.ctx.createBuffer(2, Math.floor(rate * Math.min(5, decay * 4 + 0.3)), rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < d.length; i++) d[i] = i < 400 ? 0 : (Math.random() * 2 - 1) * Math.exp(-i / (rate * decay * 0.45));
    }
    this.conv.buffer = ir; this.revDecay = decay;
  }

  // Semitonos del canal cuando el efecto elegido es TONO: el dial global fija el intervalo (±24) y el del canal cuánto se aplica.
  pitchOf(ch) { return state.fxSel === 2 ? Math.round((state.fxAmt - 0.5) * 48 * state.ch[ch].fx) : 0; }

  // Lleva el estado a los nodos de audio. Solo actúa el efecto elegido con el selector de FX.
  apply() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, set = (p, v) => p.setTargetAtTime(v, t, 0.015);
    const sel = state.fxSel, amt = state.fxAmt, f = (amt - 0.5) * 2;
    state.ch.forEach((c, i) => {
      const n = this.ch[i], w = c.fx;
      set(n.gain.gain, c.mute ? 0 : c.vol * c.vol);
      set(n.dly.gain, sel === 0 ? w : 0); set(n.rev.gain, sel === 1 ? w : 0);
      set(n.dry.gain, sel === 4 ? 1 - w : 1); set(n.wet.gain, sel === 4 ? w : 0);
      set(n.lp.frequency, f < -0.03 ? 20000 * Math.pow(0.008, -f) : 20000);
      set(n.hp.frequency, f > 0.03 ? 20 * Math.pow(250, f) : 20);
    });
    if (sel === 0) set(this.fb.gain, 0.1 + amt * 0.75);
    if (sel === 1) {
      const decay = 0.3 + Math.round(amt * 10) / 10 * 2.2;
      if (decay !== this.revDecay) { clearTimeout(this.revTimer); this.revTimer = setTimeout(() => this.setReverb(decay), 120); }
    }
    set(this.out.gain, state.volume * state.volume);
    set(this.loopBus.gain, state.loopVol);
    set(this.delay.delayTime, Math.min(1.9, 3 * 60 / state.bpm / 4)); // corchea con puntillo
  }

  toBuffer(data, sr = SR) {
    const b = this.ctx.createBuffer(1, Math.max(1, data.length), sr);
    b.getChannelData(0).set(data);
    return b;
  }

  async loadKit(k) {
    const kit = KITS[k], buf = [], names = [], custom = [];
    for (let ch = 0; ch < ROWS; ch++) {
      buf[ch] = []; names[ch] = []; custom[ch] = [];
      for (let side = 0; side < 2; side++) {
        const own = await idb.get(sampleKey(k, ch, side));
        custom[ch][side] = !!own;
        names[ch][side] = own ? own.name : kit.sounds[ch][side].name;
        buf[ch][side] = own ? this.toBuffer(own.data, own.sr) : this.toBuffer(synth(kit.sounds[ch][side].spec));
      }
    }
    Object.assign(this, { buf, names, custom });
  }

  async setCustom(ch, side, data, sr, name) {
    await idb.set(sampleKey(state.kit, ch, side), { name, sr, data });
    this.buf[ch][side] = this.toBuffer(data, sr); this.names[ch][side] = name; this.custom[ch][side] = true;
  }
  async clearCustom(ch, side) {
    await idb.del(sampleKey(state.kit, ch, side));
    const s = KITS[state.kit].sounds[ch][side];
    this.buf[ch][side] = this.toBuffer(synth(s.spec)); this.names[ch][side] = s.name; this.custom[ch][side] = false;
  }
  hasCustom() { return this.custom.some(c => c.some(Boolean)); }

  trigger(ch, time, side = state.ch[ch].side) {
    const b = this.buf[ch]?.[side];
    if (!b || !this.ctx) return;
    const src = this.ctx.createBufferSource();
    const t = time ?? this.ctx.currentTime, w = state.ch[ch].fx;
    src.buffer = b; src.playbackRate.value = Math.pow(2, this.pitchOf(ch) / 12);
    if (state.fxSel === 3 && w > 0.02) { // GATE: recorta la cola del sample
      const len = (0.03 + state.fxAmt * 0.4) * (1 + (1 - w) * 6), g = this.ctx.createGain();
      g.gain.setValueAtTime(1, t); g.gain.setValueAtTime(1, t + len); g.gain.linearRampToValueAtTime(0, t + len + 0.015);
      src.connect(g).connect(this.ch[ch].inp); src.start(t); src.stop(t + len + 0.03);
    } else { src.connect(this.ch[ch].inp); src.start(t); }
  }

  note(time, midi, dur, tim) {
    const c = this.ctx, T = TIMBRES[tim], f = 440 * Math.pow(2, (midi - 69) / 12);
    const g = c.createGain(), flt = c.createBiquadFilter();
    flt.type = 'lowpass'; flt.frequency.setValueAtTime(T.cut + (T.fenv || 0), time);
    if (T.fenv) flt.frequency.exponentialRampToValueAtTime(T.cut, time + 0.15);
    const atk = T.atk || 0.005, rel = T.rel || 0.06;
    g.gain.setValueAtTime(0, time); g.gain.linearRampToValueAtTime(1, time + atk);
    let end;
    if (T.perc) { end = time + Math.max(dur, T.perc * 3); g.gain.setTargetAtTime(0, time + atk, T.perc); }
    else { end = time + dur + rel * 4; g.gain.setTargetAtTime(0, time + dur, rel); }
    flt.connect(g).connect(this.loopBus);
    for (const [type, ratio, amp, det] of T.w) {
      const o = c.createOscillator(), og = c.createGain();
      o.type = type; o.frequency.value = f * ratio; if (det) o.detune.value = det;
      og.gain.value = amp; o.connect(og).connect(flt); o.start(time); o.stop(end);
    }
  }

  start() {
    this.tick = 0; this.marks = []; this.nextTime = this.ctx.currentTime + 0.06; this.playing = true;
    this.timer = setInterval(() => this.pump(), 25);
    this.pump();
  }
  stop() {
    this.playing = false; clearInterval(this.timer); this.override = null;
    this.loopSrc?.forEach(s => { try { s.stop(); } catch { /* ya parado */ } });
    this.loopSrc = [];
    this.onChange();
  }
  async toggle() { await this.ensure(); if (!this.ctx) return; this.playing ? this.stop() : this.start(); this.onChange(); }

  pump() {
    while (this.playing && this.nextTime < this.ctx.currentTime + 0.12) {
      this.schedule(this.tick, this.nextTime);
      this.tick++; this.nextTime += 60 / state.bpm / 4;
    }
  }

  schedule(t, time) {
    const sd = 60 / state.bpm / 4, sub = t & 1, len = state.length * 2;
    if (this.override && t >= len * this.override.cycles) { setTimeout(() => this.stop(), (time - this.ctx.currentTime) * 1000); this.playing = false; return; }
    const col = (t % len) >> 1, tt = time + (sub ? state.swing / 100 * sd * 0.66 : 0);
    const grid = this.override ? this.override.grid : state.grid;
    for (let r = 0; r < ROWS; r++) {
      const v = grid[r][col];
      if (v === 3 || (v === 1 && !sub) || (v === 2 && sub)) this.trigger(r, tt);
    }
    this.marks.push({ time: tt, col, sub });
    if (this.override) return;
    const kit = KITS[state.kit], L = kit.loops, lt = t % 64, bar = lt >> 4, st = lt & 15;
    for (let i = 0; i < 4; i++) {
      if (!state.loops[i]) continue;
      const slot = this.loopSlots[i];
      if (slot) {
        if (t % slot.steps === 0) {
          const src = this.ctx.createBufferSource();
          src.buffer = slot.buffer; src.playbackRate.value = state.bpm / slot.bpm;
          src.connect(this.loopBus); src.start(time);
          (this.loopSrc ||= []).push(src);
          if (this.loopSrc.length > 16) this.loopSrc.shift();
        }
        continue;
      }
      const part = L.parts[i], c = part.pat[st];
      if (c === '.' || c === '-') continue;
      let hold = 0;
      while (st + hold + 1 < 16 && part.pat[st + hold + 1] === '-') hold++;
      const degs = c === 'x' ? [0, 2, 4] : [Number(c)];
      for (const d of degs) this.note(tt, degToMidi(kit, L.prog[bar] + d, part.oct), (1 + hold) * sd * 0.9, part.tim);
    }
  }

  // Columna que suena ahora mismo (para la luz de paso).
  playCol() {
    if (!this.playing) return -1;
    const now = this.ctx.currentTime;
    while (this.marks.length > 1 && this.marks[1].time <= now) this.marks.shift();
    return this.marks.length && this.marks[0].time <= now ? this.marks[0].col : -1;
  }

  // Juego/tutorial: escuchar un patrón objetivo sin tocar el tuyo.
  async playTarget(grid, cycles = 2) {
    await this.ensure();
    if (!this.ctx) return;
    if (this.playing) this.stop();
    this.override = { grid, cycles };
    this.start(); this.onChange();
  }

  // --- Sampler ---
  async decode(arrayBuf, maxSec) {
    const ab = await this.ctx.decodeAudioData(arrayBuf);
    const mono = new Float32Array(ab.length);
    for (let c = 0; c < ab.numberOfChannels; c++) { const d = ab.getChannelData(c); for (let i = 0; i < d.length; i++) mono[i] += d[i] / ab.numberOfChannels; }
    return { data: tidy(mono, ab.sampleRate, maxSec), sr: ab.sampleRate };
  }

  async micStart(ch) {
    await this.ensure();
    if (!this.ctx) throw new Error('sin audio');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    const rec = new MediaRecorder(stream), chunks = [];
    rec.ondataavailable = e => chunks.push(e.data);
    this.micDone = new Promise(res => {
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        try {
          const { data, sr } = await this.decode(await new Blob(chunks).arrayBuffer(), 5);
          if (data.length > 200) { await this.setCustom(ch, state.ch[ch].side, data, sr, 'Grabación'); this.trigger(ch); }
        } catch (e) { console.warn('No se pudo procesar la grabación', e); }
        this.micRec = null; this.micCh = -1; this.micArmed = false; this.onChange(); res();
      };
    });
    rec.start(); this.micRec = rec; this.micCh = ch;
    this.micTimer = setTimeout(() => this.micStop(), 5000);
    this.onChange();
  }
  micStop() { clearTimeout(this.micTimer); if (this.micRec?.state === 'recording') this.micRec.stop(); return this.micDone; }

  async loadFile(ch, file) {
    await this.ensure();
    if (!this.ctx) throw new Error('sin audio');
    const { data, sr } = await this.decode(await file.arrayBuffer(), 8);
    if (!data.length) throw new Error('Audio vacío');
    await this.setCustom(ch, state.ch[ch].side, data, sr, file.name.replace(/\.[^.]+$/, '').slice(0, 24));
    this.trigger(ch);
  }

  // Resamplea un ciclo del patrón (sin efectos) a un canal de loop.
  async resample(slot) {
    await this.ensure();
    if (!this.ctx) return;
    const sd = 60 / state.bpm / 4, steps = state.length * 2;
    const oc = new OfflineAudioContext(2, Math.ceil(steps * sd * SR), SR);
    for (let t = 0; t < steps; t++) {
      const sub = t & 1, col = t >> 1, tt = t * sd + (sub ? state.swing / 100 * sd * 0.66 : 0);
      for (let r = 0; r < ROWS; r++) {
        const v = state.grid[r][col], c = state.ch[r];
        if (c.mute || !(v === 3 || (v === 1 && !sub) || (v === 2 && sub))) continue;
        const src = oc.createBufferSource(), g = oc.createGain();
        src.buffer = this.buf[r][c.side]; src.playbackRate.value = Math.pow(2, this.pitchOf(r) / 12);
        g.gain.value = c.vol * c.vol; src.connect(g).connect(oc.destination); src.start(tt);
      }
    }
    this.loopSlots[slot] = { buffer: await oc.startRendering(), steps, bpm: state.bpm };
  }

  // --- Grabación de sesión ---
  async toggleSession() {
    await this.ensure();
    if (!this.recDest) return;
    if (this.sessionRec) { this.sessionRec.stop(); return; }
    const rec = new MediaRecorder(this.recDest.stream), chunks = [];
    rec.ondataavailable = e => chunks.push(e.data);
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: rec.mimeType }), a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `timbou-sesion-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${rec.mimeType.includes('ogg') ? 'ogg' : 'webm'}`;
      a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      this.sessionRec = null; this.onChange();
    };
    rec.start(); this.sessionRec = rec; this.onChange();
  }
}

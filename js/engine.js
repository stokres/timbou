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

  async ensure() {
    if (!this.ctx) { this.build(); await this.loadKit(state.kit); }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }

  build() {
    const c = this.ctx = new AudioContext({ latencyHint: 'interactive' });
    const G = v => { const g = c.createGain(); g.gain.value = v; return g; };
    this.master = G(0.6);
    this.lp = c.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.Q.value = 2;
    this.hp = c.createBiquadFilter(); this.hp.type = 'highpass'; this.hp.Q.value = 2;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 12; comp.attack.value = 0.003; comp.release.value = 0.12;
    this.out = G(0.8);
    this.recDest = c.createMediaStreamDestination();
    this.master.connect(this.lp).connect(this.hp).connect(comp).connect(this.out);
    this.out.connect(c.destination); this.out.connect(this.recDest);

    this.delayIn = G(1); this.delay = c.createDelay(2);
    const fb = G(0.42), fbLp = c.createBiquadFilter(); fbLp.type = 'lowpass'; fbLp.frequency.value = 3000;
    this.delayIn.connect(this.delay); this.delay.connect(fbLp).connect(fb).connect(this.delay);
    this.delay.connect(G(0.8)).connect(this.master);

    this.revIn = G(1);
    const conv = c.createConvolver(), ir = c.createBuffer(2, SR * 2.2, SR);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < d.length; i++) d[i] = i < 400 ? 0 : (Math.random() * 2 - 1) * Math.exp(-i / (SR * 0.5));
    }
    conv.buffer = ir;
    this.revIn.connect(conv).connect(G(0.7)).connect(this.master);

    this.ch = Array.from({ length: ROWS }, () => {
      const gain = G(0.6), dly = G(0), rev = G(0);
      gain.connect(this.master); gain.connect(dly).connect(this.delayIn); gain.connect(rev).connect(this.revIn);
      return { gain, dly, rev };
    });
    this.loopBus = G(0.6); this.loopBus.connect(this.master);
    this.loopBus.connect(G(0.15)).connect(this.revIn);
    this.apply();
  }

  // Lleva el estado a los nodos de audio.
  apply() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, set = (p, v) => p.setTargetAtTime(v, t, 0.015);
    state.ch.forEach((c, i) => {
      set(this.ch[i].gain.gain, c.mute ? 0 : c.vol * c.vol);
      set(this.ch[i].dly.gain, c.delay); set(this.ch[i].rev.gain, c.reverb);
    });
    const f = state.filter;
    set(this.lp.frequency, f < -0.03 ? 20000 * Math.pow(0.008, -f) : 20000);
    set(this.hp.frequency, f > 0.03 ? 20 * Math.pow(250, f) : 20);
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
    if (!b) return;
    const src = this.ctx.createBufferSource();
    src.buffer = b; src.playbackRate.value = Math.pow(2, state.ch[ch].pitch / 12);
    src.connect(this.ch[ch].gain); src.start(time ?? this.ctx.currentTime);
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
  async toggle() { await this.ensure(); this.playing ? this.stop() : this.start(); this.onChange(); }

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
    const { data, sr } = await this.decode(await file.arrayBuffer(), 8);
    if (!data.length) throw new Error('Audio vacío');
    await this.setCustom(ch, state.ch[ch].side, data, sr, file.name.replace(/\.[^.]+$/, '').slice(0, 24));
    this.trigger(ch);
  }

  // Resamplea un ciclo del patrón (sin efectos) a un canal de loop.
  async resample(slot) {
    await this.ensure();
    const sd = 60 / state.bpm / 4, steps = state.length * 2;
    const oc = new OfflineAudioContext(2, Math.ceil(steps * sd * SR), SR);
    for (let t = 0; t < steps; t++) {
      const sub = t & 1, col = t >> 1, tt = t * sd + (sub ? state.swing / 100 * sd * 0.66 : 0);
      for (let r = 0; r < ROWS; r++) {
        const v = state.grid[r][col], c = state.ch[r];
        if (c.mute || !(v === 3 || (v === 1 && !sub) || (v === 2 && sub))) continue;
        const src = oc.createBufferSource(), g = oc.createGain();
        src.buffer = this.buf[r][c.side]; src.playbackRate.value = Math.pow(2, c.pitch / 12);
        g.gain.value = c.vol * c.vol; src.connect(g).connect(oc.destination); src.start(tt);
      }
    }
    this.loopSlots[slot] = { buffer: await oc.startRendering(), steps, bpm: state.bpm };
  }

  // --- Grabación de sesión ---
  async toggleSession() {
    await this.ensure();
    if (this.sessionRec) { this.sessionRec.stop(); return; }
    const rec = new MediaRecorder(this.recDest.stream), chunks = [];
    rec.ondataavailable = e => chunks.push(e.data);
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: rec.mimeType }), a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `tembo-sesion-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${rec.mimeType.includes('ogg') ? 'ogg' : 'webm'}`;
      a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      this.sessionRec = null; this.onChange();
    };
    rec.start(); this.sessionRec = rec; this.onChange();
  }
}

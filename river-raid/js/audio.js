/**
 * audio.js — процедурный 8-битный аудиодвижок для порта River Raid.
 *
 * Обычный <script> (не ES-модуль), без ассетов/CDN/сети: публикует window.Chiptune.
 * Музыка и SFX синтезируются из пульсовых, треугольных и пилообразных волн и шума.
 * Три зацикленных трека (menu/game/over) играет lookahead-планировщик
 * (тик 20 мс, окно 100 мс), поэтому ритм не зависит от загрузки вкладки.
 *
 * API: init() -> AudioContext|null; create(baseCtx) -> engine;
 * startMusic('menu'|'game'|'over'); stopMusic(fadeSec); sfx(name);
 * setMuted/isMuted; setVolume/getVolume; setPaused. engine умеет то же + поле ctx.
 */
(function (global) {
  'use strict';
  /* ================= 1. Константы, ноты, кэши ================= */

  const TICK_MS = 20, LOOKAHEAD = 0.1, XFADE = 0.45, STOP_FADE = 0.25, SILENCE = 0.0001;
  const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const CHORDS = {
    '': [0, 4, 7], m: [0, 3, 7], dim: [0, 3, 6], sus4: [0, 5, 7],
    '7': [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11],
  };
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  // "A4" / "C#5" / "Bb2" -> MIDI-номер (C4 = 60).
  function midiOf(name) {
    const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
    if (!m) throw new Error('audio.js: неизвестная нота ' + name);
    const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
    return SEMI[m[1]] + acc + (parseInt(m[3], 10) + 1) * 12;
  }
  // "Am" + октава -> { root, tones:[...] }.
  function chordOf(name, oct) {
    const m = /^([A-G][#b]?)(.*)$/.exec(name);
    const root = midiOf(m[1] + oct);
    return { root: root, tones: (CHORDS[m[2]] || CHORDS['']).map((x) => root + x) };
  }
  // Волны и шум кэшируются на каждый AudioContext (WeakMap — без утечек).
  const CTX_MEM = new WeakMap();
  function ctxMem(ctx) {
    let m = CTX_MEM.get(ctx);
    if (!m) { m = { waves: Object.create(null), noise: null }; CTX_MEM.set(ctx, m); }
    return m;
  }
  // Пульс заданной скважности (0.125/0.25/0.5) через ряд Фурье.
  function pulseWave(ctx, duty) {
    duty = clamp(duty || 0.5, 0.05, 0.5);
    const mem = ctxMem(ctx), key = duty.toFixed(3);
    if (mem.waves[key]) return mem.waves[key];
    const H = 36, real = new Float32Array(H + 1), imag = new Float32Array(H + 1);
    for (let n = 1; n <= H; n++) imag[n] = (2 / (n * Math.PI)) * Math.sin(Math.PI * n * duty);
    return (mem.waves[key] = ctx.createPeriodicWave(real, imag, { disableNormalization: false }));
  }
  function noiseBuffer(ctx) {
    const mem = ctxMem(ctx);
    if (mem.noise) return mem.noise;
    const len = Math.floor(ctx.sampleRate * 1.5), buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return (mem.noise = buf);
  }
  // Чистка узлов после окончания источника — без утечек.
  function autoClean(src, nodes) {
    src.onended = () => {
      for (let i = 0; i < nodes.length; i++) { try { nodes[i].disconnect(); } catch (e) { /* ok */ } }
      try { src.disconnect(); } catch (e) { /* ok */ }
    };
  }
  // Мягкий клиппер (tanh): гарантирует пик < 1 и даёт чиптюн-«насыщение».
  let CLIP_CURVE = null;
  function clipCurve() {
    if (!CLIP_CURVE) {
      const N = 4096, k = 1.3;
      CLIP_CURVE = new Float32Array(N);
      for (let i = 0; i < N; i++) CLIP_CURVE[i] = Math.tanh(k * ((i / (N - 1)) * 2 - 1));
    }
    return CLIP_CURVE;
  }
  /* ================= 2. Огибающие и голоса ================= */

  function envPluck(g, t, dur, peak) { // щипок: атака, спад, закрытие
    const D = Math.max(0.035, dur), a = Math.min(0.005, D * 0.25), p = Math.max(SILENCE * 2, peak);
    g.gain.setValueAtTime(SILENCE, t);
    g.gain.linearRampToValueAtTime(p, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(SILENCE * 2, p * 0.4), t + D * 0.55);
    g.gain.exponentialRampToValueAtTime(SILENCE, t + D);
  }
  function envHold(g, t, dur, peak) { // длинная нота: атака, полка, спад
    const D = Math.max(0.06, dur), a = Math.min(0.012, D * 0.2);
    const rel = Math.min(0.08, D * 0.35), p = Math.max(SILENCE * 2, peak);
    g.gain.setValueAtTime(SILENCE, t);
    g.gain.linearRampToValueAtTime(p, t + a);
    g.gain.linearRampToValueAtTime(p * 0.85, t + D - rel);
    g.gain.linearRampToValueAtTime(SILENCE, t + D);
  }
  function envNoise(g, t, dur, peak) { // шум: мгновенная атака и спад
    const D = Math.max(0.02, dur);
    g.gain.setValueAtTime(SILENCE, t);
    g.gain.linearRampToValueAtTime(Math.max(SILENCE * 2, peak), t + 0.003);
    g.gain.exponentialRampToValueAtTime(SILENCE, t + D);
  }
  // Пульс — основной голос чиптюна. opts: hz, hzTo, vibrato, vibRate, slideTime.
  function voicePulse(ctx, dest, note, t, dur, peak, duty, opts) {
    opts = opts || {};
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.setPeriodicWave(pulseWave(ctx, duty));
    osc.frequency.setValueAtTime(Math.max(20, opts.hz || hz(note)), t);
    if (opts.hzTo) {
      const end = t + Math.max(0.02, dur * (opts.slideTime || 1));
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.hzTo), end);
    }
    envPluck(g, t, dur, peak);
    osc.connect(g).connect(dest);
    const extra = [];
    if (opts.vibrato) {
      const lfo = ctx.createOscillator(), amt = ctx.createGain();
      lfo.frequency.value = opts.vibRate || 5.2;
      amt.gain.setValueAtTime(0, t);
      amt.gain.linearRampToValueAtTime(opts.vibrato, t + Math.min(0.16, dur * 0.6));
      lfo.connect(amt);
      amt.connect(osc.detune);
      lfo.start(t);
      lfo.stop(t + dur + 0.05);
      extra.push(lfo, amt);
    }
    osc.start(t);
    osc.stop(t + dur + 0.03);
    autoClean(osc, [g].concat(extra));
  }
  // Треугольный бас.
  function voiceTri(ctx, dest, note, t, dur, peak) {
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = 'triangle'; osc.frequency.value = hz(note);
    envHold(g, t, dur, peak);
    osc.connect(g).connect(dest);
    osc.start(t); osc.stop(t + dur + 0.03);
    autoClean(osc, [g]);
  }
  // Пила с фильтром — атмосферная подложка.
  function voiceSaw(ctx, dest, note, t, dur, peak, cutoff) {
    const osc = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    osc.type = 'sawtooth'; osc.frequency.value = hz(note); osc.detune.value = -5;
    lp.type = 'lowpass'; lp.Q.value = 1.1;
    lp.frequency.setValueAtTime(cutoff || 1200, t);
    lp.frequency.linearRampToValueAtTime(Math.max(200, (cutoff || 1200) * 0.55), t + dur);
    envHold(g, t, dur, peak);
    osc.connect(lp).connect(g).connect(dest);
    osc.start(t); osc.stop(t + dur + 0.03);
    autoClean(osc, [lp, g]);
  }
  // Шумовой удар. opts: filter, f0, f1, q.
  function voiceNoise(ctx, dest, t, dur, peak, opts) {
    opts = opts || {};
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuffer(ctx); src.loop = true;
    f.type = opts.filter || 'highpass'; f.Q.value = opts.q || 0.7;
    f.frequency.setValueAtTime(Math.max(30, opts.f0 || 4000), t);
    if (opts.f1) f.frequency.exponentialRampToValueAtTime(Math.max(30, opts.f1), t + dur);
    envNoise(g, t, dur, peak);
    src.connect(f).connect(g).connect(dest);
    src.start(t); src.stop(t + dur + 0.03);
    autoClean(src, [f, g]);
  }
  /* ---------- барабаны (всё синтез, без сэмплов) ---------- */

  function sineHit(ctx, dest, t, dur, peak, f0, f1) {
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.55);
    g.gain.setValueAtTime(SILENCE, t);
    g.gain.linearRampToValueAtTime(Math.max(SILENCE * 2, peak), t + 0.004);
    g.gain.exponentialRampToValueAtTime(SILENCE, t + dur);
    osc.connect(g).connect(dest);
    osc.start(t); osc.stop(t + dur + 0.02);
    autoClean(osc, [g]);
  }
  function drumKick(ctx, dest, t, peak) {
    sineHit(ctx, dest, t, 0.16, peak, 150, 48);
    voiceNoise(ctx, dest, t, 0.018, peak * 0.3, { filter: 'bandpass', f0: 2000, q: 1.4 });
  }
  function drumSnare(ctx, dest, t, peak) {
    voiceNoise(ctx, dest, t, 0.11, peak, { filter: 'highpass', f0: 1800, q: 0.8 });
    sineHit(ctx, dest, t, 0.08, peak * 0.45, 190, 120);
  }
  function drumHat(ctx, dest, t, peak, open) {
    voiceNoise(ctx, dest, t, open ? 0.16 : 0.035, peak, { filter: 'highpass', f0: 7200, q: 0.6 });
  }
  function drumCrash(ctx, dest, t, peak) {
    voiceNoise(ctx, dest, t, 0.45, peak, { filter: 'highpass', f0: 3500, q: 0.5 });
    voiceNoise(ctx, dest, t + 0.01, 0.3, peak * 0.5, { filter: 'bandpass', f0: 5200, q: 0.7 });
  }
  function playDrum(ctx, dest, kind, t, vel) {
    if (kind === 'kick') drumKick(ctx, dest, t, vel);
    else if (kind === 'snare') drumSnare(ctx, dest, t, vel);
    else if (kind === 'hat') drumHat(ctx, dest, t, vel, false);
    else if (kind === 'openhat') drumHat(ctx, dest, t, vel, true);
    else if (kind === 'tom') sineHit(ctx, dest, t, 0.22, vel, 210, 110);
    else if (kind === 'crash') drumCrash(ctx, dest, t, vel);
  }
  /* ================= 3. Паттерны и композиции ================= */

  function Track(bpm, bars, stepsPerBeat, swing) {
    this.bpm = bpm; this.bars = bars; this.stepsPerBeat = stepsPerBeat;
    this.stepsPerBar = stepsPerBeat * 4; this.loopSteps = bars * this.stepsPerBar;
    this.swing = swing || 0;
    this.ch = {}; this.mix = {}; this.events = [];
  }
  Track.prototype.chan = function (name, cfg, mix) {
    this.ch[name] = cfg; this.mix[name] = mix; return this;
  };
  Track.prototype.add = function (bar, step, chan, note, len, vel) {
    if (step < 0 || step >= this.stepsPerBar) return;
    this.events.push({ s: bar * this.stepsPerBar + step, c: chan, m: note, l: len, v: vel });
  };
  Track.prototype.drum = function (bar, step, kind, vel) {
    if (step < 0 || step >= this.stepsPerBar) return;
    this.events.push({ s: bar * this.stepsPerBar + step, k: kind, v: vel });
  };
  // Нотная строка: токен = шаг сетки. "D5:2" — нота, "-" — пауза, "." — продлить.
  Track.prototype.line = function (bar, step, chan, text, vel) {
    const tokens = text.trim().split(/\s+/);
    let last = null;
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i], at = step + i;
      if (tok === '-') { last = null; continue; }
      if (tok === '.') { if (last) last.l += 1; continue; }
      if (at < 0 || at >= this.stepsPerBar) continue;
      const parts = tok.split(':');
      const len = parts.length > 1 ? Math.max(1, parseInt(parts[1], 10)) : 1;
      last = { s: bar * this.stepsPerBar + at, c: chan, m: midiOf(parts[0]), l: len, v: vel };
      this.events.push(last);
    }
    return this;
  };
  // Раскладываем события по сетке и применяем баланс каналов.
  Track.prototype.compile = function () {
    const grid = [];
    for (let i = 0; i < this.loopSteps; i++) grid.push([]);
    for (let i = 0; i < this.events.length; i++) {
      const e = this.events[i];
      const s = ((e.s % this.loopSteps) + this.loopSteps) % this.loopSteps;
      // ноту не тянем через шов лупа — цикл остаётся бесшовным
      const len = Math.max(1, Math.min(e.l, this.loopSteps - s));
      const mix = e.c && this.mix[e.c] != null ? this.mix[e.c] : 1;
      grid[s].push({ c: e.c || null, k: e.k || null, m: e.m, l: len, v: e.v * mix });
    }
    return {
      bpm: this.bpm, bars: this.bars, stepsPerBeat: this.stepsPerBeat,
      stepsPerBar: this.stepsPerBar, loopSteps: this.loopSteps,
      swing: this.swing, ch: this.ch, grid: grid,
    };
  };
  /* ---------- menu: 132 BPM, ля минор, 16 тактов ---------- */
  const MENU_PROG = ['Am', 'Am', 'F', 'F', 'C', 'C', 'G', 'G',
                     'Am', 'Am', 'F', 'F', 'Dm', 'Dm', 'E', 'E'];
  function buildMenu() {
    const t = new Track(132, 16, 4, 0.1);
    t.chan('arp', { inst: 'pulse', duty: 0.125, gate: 0.75 }, 0.085);
    t.chan('lead', { inst: 'pulse', duty: 0.25, gate: 0.92, vibrato: 9 }, 0.12);
    t.chan('bass', { inst: 'tri', gate: 1 }, 0.2);
    t.chan('pad', { inst: 'saw', gate: 1, cutoff: 900 }, 0.055);
    const arpFig = [0, 1, 2, 1, 0, 1, 2, 1];
    for (let bar = 0; bar < t.bars; bar++) {
      const ch = chordOf(MENU_PROG[bar], 4);
      // Арпеджио восьмыми — «лицо» меню.
      for (let k = 0; k < 8; k++) {
        let m = ch.tones[arpFig[k]];
        if (bar % 4 === 3 && k >= 6) m += 12; // подъём в конце фразы
        t.add(bar, k * 2, 'arp', m, 1, k === 0 ? 1 : k === 4 ? 0.9 : 0.72);
      }
      // Бас: половинные + квинта в конце такта.
      t.add(bar, 0, 'bass', ch.root - 24, 7, 0.95);
      t.add(bar, 8, 'bass', ch.root - 24, 5, 0.8);
      t.add(bar, 13, 'bass', ch.root - 24 + 7, 3, 0.55);
      // Атмосферная «подушка» через такт.
      if (bar % 2 === 0) {
        t.add(bar, 0, 'pad', ch.tones[0] - 12, 15, 0.7);
        t.add(bar, 0, 'pad', ch.tones[2] - 12, 15, 0.45);
      }
      // Редкие барабаны: тихий бит и кик на сильную долю.
      t.drum(bar, 0, 'kick', 0.5);
      if (bar % 2 === 1) t.drum(bar, 10, 'kick', 0.28);
      t.drum(bar, 2, 'hat', 0.16); t.drum(bar, 6, 'hat', 0.12);
      t.drum(bar, 10, 'hat', 0.15); t.drum(bar, 14, 'hat', 0.11);
      if (bar % 4 === 0) t.drum(bar, 8, 'snare', 0.26);
      if (bar % 8 === 7) for (let k = 0; k < 4; k++) t.drum(bar, 12 + k, 'snare', 0.24 + k * 0.07);
    }
    // Контрмелодия во второй половине каждого восьмитакта.
    const mel = [
      'E5:3 - G5:3 - A5:4 - - - G5:2 - E5:2 - - - -',
      'D5:3 - F5:3 - G5:4 - - - F5:2 - D5:2 - - - -',
      'E5:3 - B4:3 - D5:4 - - - E5:2 - B4:2 - - - -',
      'B4:3 - D5:3 - E5:6 - - - - - - - - -',
    ];
    for (let i = 0; i < 4; i++) {
      t.line(4 + i, 0, 'lead', mel[i], 1);
      t.line(12 + i, 0, 'lead', mel[i], 0.8);
    }
    return t.compile();
  }
  /* ---------- game: 154 BPM, ре минор/фригийский, 16 тактов ---------- */
  const GAME_ROOTS = [38, 38, 46, 48, 38, 38, 46, 48, 43, 46, 48, 38, 43, 46, 48, 38];
  const GAME_BASS_FIG = [0, 0, 0, 0, 0, 0, 12, 0, 0, 0, 0, 0, 7, 0, 12, 0];
  function buildGame() {
    const t = new Track(154, 16, 4, 0.06);
    t.chan('lead', { inst: 'pulse', duty: 0.25, gate: 0.9, vibrato: 8 }, 0.125);
    t.chan('harm', { inst: 'pulse', duty: 0.5, gate: 0.85 }, 0.05);
    t.chan('bass', { inst: 'tri', gate: 0.82 }, 0.22);
    // A-секция: 8 тактов главного риффа.
    const A = [
      'D5 F5 A5 - G5 F5 E5 D5 C5 D5 E5 F5 - D5 - -',
      'D5 F5 A5 - C6 A5 F5 D5 E5 F5 E5 D5 - A4 - -',
      'Bb4 D5 F5 - Bb5 A5 G5 F5 G5 F5 E5 D5 - D5 - -',
      'C5 E5 G5 - C6 Bb5 A5 G5 F5 E5 D5 C5 - G4 - -',
      'D5 F5 A5 - G5 F5 E5 D5 C5 D5 E5 F5 - A5 - -',
      'D5 F5 A5 - D6 C6 A5 F5 E5 F5 G5 A5 - D5 - -',
      'Bb4 D5 F5 - Bb5 A5 G5 F5 G5 A5 Bb5 - F5 - -',
      'C5 E5 G5 - C6 Bb5 A5 G5 A5 Bb5 C6 - G5 - -',
    ];
    // B-секция: разрядка, длинные ноты, другой регистр.
    const B = [
      'G5:2 - D5:2 - G5:2 - Bb5:2 - A5:2 - G5:2 - F5:2 - - -',
      'F5:2 - D5:2 - F5:2 - Bb5:2 - A5:2 - F5:2 - D5:2 - - -',
      'E5:2 - G5:2 - C6:2 - Bb5:2 - A5:2 - G5:2 - E5:2 - - -',
      'D5:2 - F5:2 - A5:2 - D6:2 - C6:2 - A5:2 - F5:2 - - -',
      'G5:2 - Bb5:2 - D6:2 - C6:2 - Bb5:2 - A5:2 - G5:2 - - -',
      'A5:2 - F5:2 - D5:2 - F5:2 - Bb5:2 - A5:2 - F5:2 - - -',
      'E5:2 - G5:2 - C6:2 - D6:2 - C6:2 - Bb5:2 - G5:2 - - -',
      'D5 E5 F5 G5 A5 Bb5 C6 D6 - A5 - F5 - D5 - -',
    ];
    for (let i = 0; i < 8; i++) {
      t.line(i, 0, 'lead', A[i], 1);
      t.line(8 + i, 0, 'lead', B[i], 1);
    }
    for (let bar = 0; bar < t.bars; bar++) {
      const root = GAME_ROOTS[bar];
      // Бас-остинато шестнадцатыми — двигатель трека.
      for (let st = 0; st < 16; st++) {
        t.add(bar, st, 'bass', root + GAME_BASS_FIG[st], 1, st % 4 === 0 ? 1 : 0.68);
      }
      // Гармоническая подложка в B-секции.
      if (bar >= 8) {
        t.add(bar, 0, 'harm', root + 12, 8, 0.5);
        t.add(bar, 8, 'harm', root + 19, 8, 0.4);
      }
      // Барабаны: бочка/снейр/хэты + филлы каждые 4 такта.
      t.drum(bar, 0, 'kick', 0.68);
      t.drum(bar, 8, 'kick', 0.6);
      if (bar % 2 === 1) t.drum(bar, 6, 'kick', 0.3);
      t.drum(bar, 4, 'snare', 0.5);
      t.drum(bar, 12, 'snare', 0.52);
      if (bar === 0 || bar === 8) t.drum(bar, 0, 'crash', 0.36);
      for (let st = 0; st < 16; st += 2) {
        const accent = st % 4 === 0;
        t.drum(bar, st, 'hat', accent ? 0.22 : 0.13);
        if (bar >= 8 && !accent) t.drum(bar, st + 1, 'hat', 0.08);
      }
      if (bar % 4 === 3) for (let k = 0; k < 4; k++) t.drum(bar, 12 + k, 'snare', 0.34 + k * 0.1);
      if (bar === 15) { t.drum(bar, 14, 'tom', 0.45); t.drum(bar, 15, 'tom', 0.5); }
    }
    return t.compile();
  }
  /* ---------- over: 128 BPM, 4 такта, грустный луп (~7.5 с) ---------- */
  function buildOver() {
    const t = new Track(128, 4, 4, 0.04);
    t.chan('lead', { inst: 'pulse', duty: 0.5, gate: 0.95, vibrato: 12 }, 0.13);
    t.chan('bass', { inst: 'tri', gate: 1 }, 0.2);
    t.chan('pad', { inst: 'saw', gate: 1, cutoff: 700 }, 0.06);
    const prog = ['Am', 'F', 'Dm', 'E'];
    const mel = [
      'A4:4 - - - C5:4 - - - B4:4 - - - A4:4 - - -',
      'G4:4 - - - A4:4 - - - F4:4 - - - E4:4 - - -',
      'F4:4 - - - A4:4 - - - D5:4 - - - C5:4 - - -',
      'B4:4 - - - G#4:4 - - - E4:6 - - - - - -',
    ];
    for (let bar = 0; bar < 4; bar++) {
      const ch = chordOf(prog[bar], 3);
      t.line(bar, 0, 'lead', mel[bar], 1);
      t.add(bar, 0, 'bass', ch.root - 12, 15, 0.9);
      t.add(bar, 0, 'pad', ch.tones[0] + 12, 15, 0.7);
      t.add(bar, 0, 'pad', ch.tones[2] + 12, 15, 0.45);
      // Разреженный бит — горечь, а не марш.
      t.drum(bar, 0, 'kick', 0.38);
      t.drum(bar, 8, 'hat', 0.1);
      if (bar === 3) { t.drum(bar, 8, 'snare', 0.18); t.drum(bar, 12, 'kick', 0.28); }
    }
    return t.compile();
  }
  const TRACK_BUILDERS = { menu: buildMenu, game: buildGame, over: buildOver };
  const TRACK_CACHE = Object.create(null);
  function trackDef(name) {
    const build = TRACK_BUILDERS[name];
    if (!build) return null;
    if (!TRACK_CACHE[name]) TRACK_CACHE[name] = build();
    return TRACK_CACHE[name];
  }
  /* ================= 4. Sequence: трек + планировщик ================= */

  function Sequence(engine, name, def) {
    this.engine = engine; this.ctx = engine.ctx;
    this.name = name; this.def = def;
    this.stepDur = 60 / def.bpm / def.stepsPerBeat;
    this.loopSteps = def.loopSteps; this.grid = def.grid;
    this.gain = this.ctx.createGain(); // шина трека для кроссфейда
    this.gain.gain.value = SILENCE;
    this.gain.connect(engine.musicBus);
    this.timer = null; this.dead = false; this.pausedAt = null;
    this.nextStep = 0; this.nextTime = 0;
    this._tick = this.tick.bind(this);
  }
  Sequence.prototype.start = function (at) {
    const now = this.ctx.currentTime, t0 = Math.max(at == null ? now : at, now);
    const g = this.gain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(SILENCE, now);
    g.linearRampToValueAtTime(1, t0 + XFADE);
    this.nextTime = t0; this.nextStep = 0;
    if (this.engine.offline) {
      // В OfflineAudioContext время стоит до render(): планируем весь диапазон.
      this.scheduleUntil((this.ctx.length / this.ctx.sampleRate || 30) + 0.5);
    } else if (this.engine.paused) {
      this.pausedAt = now;
    } else {
      this.startTimer();
    }
  };
  Sequence.prototype.startTimer = function () {
    if (this.timer || this.dead) return;
    this.timer = setInterval(this._tick, TICK_MS);
    this.tick();
  };
  Sequence.prototype.tick = function () {
    if (!this.dead && !this.engine.offline) this.scheduleUntil(this.ctx.currentTime + LOOKAHEAD);
  };
  Sequence.prototype.scheduleUntil = function (horizon) {
    let guard = 0;
    while (this.nextTime <= horizon && guard++ < 30000) {
      const step = this.nextStep, time = this.nextTime;
      this.nextStep = (step + 1) % this.loopSteps;
      this.nextTime += this.stepDur;
      // лёгкий свинг: слабая восьмая чуть запаздывает
      const t = this.def.swing && step % 4 === 2 ? time + this.def.swing * this.stepDur : time;
      const row = this.grid[step];
      if (row) for (let i = 0; i < row.length; i++) this.playEvent(row[i], t);
    }
  };
  Sequence.prototype.playEvent = function (ev, t) {
    const ctx = this.ctx;
    if (ev.k) { playDrum(ctx, this.gain, ev.k, t, ev.v); return; }
    const cfg = this.def.ch[ev.c] || {};
    const dur = Math.max(0.045, ev.l * this.stepDur * (cfg.gate != null ? cfg.gate : 0.9));
    if (cfg.inst === 'tri') voiceTri(ctx, this.gain, ev.m, t, dur, ev.v);
    else if (cfg.inst === 'saw') voiceSaw(ctx, this.gain, ev.m, t, dur, ev.v, cfg.cutoff);
    else voicePulse(ctx, this.gain, ev.m, t, dur, ev.v, cfg.duty || 0.5, { vibrato: cfg.vibrato });
  };
  Sequence.prototype.pauseAt = function (t) {
    if (this.dead) return;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    this.pausedAt = t;
  };
  Sequence.prototype.resumeAt = function (t) {
    if (this.dead || this.pausedAt == null) return;
    // Сдвигаем музыкальные часы на длительность паузы — играем с того же места.
    this.nextTime += Math.max(0, t - this.pausedAt); this.pausedAt = null; this.startTimer();
  };
  Sequence.prototype.stop = function (fadeSec) {
    if (this.dead) return;
    this.dead = true;
    const now = this.ctx.currentTime;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    const f = Math.max(0.02, fadeSec == null ? STOP_FADE : fadeSec), g = this.gain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(Math.max(SILENCE, g.value), now);
    g.linearRampToValueAtTime(SILENCE, now + f);
    // Ноты уже имеют конечный stop(); шину отключаем после затухания.
    if (!this.engine.offline) {
      const self = this;
      setTimeout(() => { try { self.gain.disconnect(); } catch (e) { /* ok */ } }, (f + 0.15) * 1000);
    }
  };
  /* ================= 5. Engine: мастер-шина и API ================= */

  function Engine(baseCtx) {
    const ctx = baseCtx;
    this.ctx = ctx;
    this.offline = typeof ctx.startRendering === 'function';
    this.volume = 1; this.muted = false; this.paused = false;
    this.cur = null; this.curName = null;
    // [musicBus + sfxBus] -> pause -> volume/mute -> лимитер -> сатуратор -> выход
    const musicBus = ctx.createGain(), sfxBus = ctx.createGain();
    const pauseGain = ctx.createGain(), master = ctx.createGain();
    musicBus.gain.value = pauseGain.gain.value = master.gain.value = 1; sfxBus.gain.value = 0.9;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10; limiter.knee.value = 6; limiter.ratio.value = 8;
    limiter.attack.value = 0.003; limiter.release.value = 0.15;
    // Шейпер-сатуратор: страхует от клиппинга и добавляет «8-битный» характер.
    const shaper = ctx.createWaveShaper();
    shaper.curve = clipCurve(); shaper.oversample = '4x';
    const out = ctx.createGain(); out.gain.value = 0.82;
    // Громкость/мьют — после лимитера: setVolume обязан быть линейным.
    musicBus.connect(pauseGain); sfxBus.connect(pauseGain); pauseGain.connect(limiter);
    limiter.connect(shaper).connect(out).connect(master).connect(ctx.destination);
    this.musicBus = musicBus; this.sfxBus = sfxBus; this.pauseGain = pauseGain;
    this.master = master; this.limiter = limiter; this.shaper = shaper; this.out = out;
  }
  Engine.prototype.startMusic = function (name) {
    const def = trackDef(name);
    if (!def) return;
    if (this.cur && this.curName === name && !this.cur.dead) return; // повтор — no-op
    if (this.cur && !this.cur.dead) this.cur.stop(XFADE); // кроссфейд
    const seq = new Sequence(this, name, def);
    this.cur = seq; this.curName = name;
    seq.start(this.ctx.currentTime);
  };
  Engine.prototype.stopMusic = function (fadeSec) {
    if (this.cur) this.cur.stop(fadeSec == null ? STOP_FADE : fadeSec);
    this.cur = null; this.curName = null;
  };
  Engine.prototype.sfx = function (name) {
    const fn = SFX[name];
    if (!fn || this.paused) return; // неизвестное имя молча игнорируем
    try { fn(this, this.ctx.currentTime + 0.005); }
    catch (e) { if (global.console && global.console.warn) global.console.warn('audio.js: sfx ' + name, e); }
  };
  Engine.prototype._applyVolume = function (ramp) {
    const g = this.master.gain, now = this.ctx.currentTime;
    const target = this.muted ? SILENCE : Math.max(SILENCE, this.volume);
    g.cancelScheduledValues(now);
    g.setValueAtTime(Math.max(SILENCE, g.value), now);
    if (ramp > 0) g.linearRampToValueAtTime(target, now + ramp);
    else g.setValueAtTime(target, now);
  };
  Engine.prototype.setVolume = function (v) {
    this.volume = clamp(Number(v) || 0, 0, 1);
    this._applyVolume(0.03);
  };
  Engine.prototype.getVolume = function () { return this.volume; };
  Engine.prototype.setMuted = function (m) { this.muted = !!m; this._applyVolume(0.02); };
  Engine.prototype.isMuted = function () { return this.muted; };
  Engine.prototype.isPaused = function () { return this.paused; };
  Engine.prototype.setPaused = function (p) {
    p = !!p;
    if (this.paused === p) return;
    this.paused = p;
    const now = this.ctx.currentTime, g = this.pauseGain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(Math.max(SILENCE, g.value), now);
    g.linearRampToValueAtTime(p ? SILENCE : 1, now + 0.03); // без щелчков
    if (this.cur) { if (p) this.cur.pauseAt(now); else this.cur.resumeAt(now); }
  };
  /* ================= 6. SFX (все процедурные) ================= */

  const SFX = {
    shot: (E, t) => { // выстрел игрока
      voicePulse(E.ctx, E.sfxBus, 0, t, 0.07, 0.5, 0.25, { hz: 1100, hzTo: 480 });
      voiceNoise(E.ctx, E.sfxBus, t, 0.03, 0.12, { filter: 'highpass', f0: 2600 });
    },
    enemyShot: (E, t) => { // выстрел врага
      voicePulse(E.ctx, E.sfxBus, 0, t, 0.11, 0.4, 0.5, { hz: 460, hzTo: 190 });
    },
    explosion: (E, t) => { // взрыв
      voiceNoise(E.ctx, E.sfxBus, t, 0.34, 0.5, { filter: 'lowpass', f0: 1700, f1: 180 });
      voiceNoise(E.ctx, E.sfxBus, t, 0.12, 0.28, { filter: 'bandpass', f0: 900, q: 0.9 });
      voicePulse(E.ctx, E.sfxBus, 0, t, 0.28, 0.32, 0.5, { hz: 170, hzTo: 45 });
    },
    bigExplosion: (E, t) => { // большой взрыв с догоном
      voiceNoise(E.ctx, E.sfxBus, t, 0.85, 0.55, { filter: 'lowpass', f0: 2000, f1: 90 });
      voiceNoise(E.ctx, E.sfxBus, t, 0.3, 0.32, { filter: 'bandpass', f0: 700, q: 0.7 });
      voiceNoise(E.ctx, E.sfxBus, t + 0.16, 0.5, 0.22, { filter: 'lowpass', f0: 900, f1: 100 });
      voicePulse(E.ctx, E.sfxBus, 0, t, 0.6, 0.34, 0.5, { hz: 140, hzTo: 38 });
    },
    crash: (E, t) => { // падение
      voiceNoise(E.ctx, E.sfxBus, t, 0.55, 0.45, { filter: 'bandpass', f0: 1100, f1: 220, q: 0.8 });
      voicePulse(E.ctx, E.sfxBus, 0, t, 0.5, 0.35, 0.25, { hz: 220, hzTo: 55, slideTime: 0.8 });
    },
    fuel: (E, t) => { // заправка
      [72, 76, 79].forEach((n, i) => voicePulse(E.ctx, E.sfxBus, n, t + i * 0.055, 0.07, 0.26, 0.25));
    },
    select: (E, t) => { // выбор в меню
      voicePulse(E.ctx, E.sfxBus, 0, t, 0.05, 0.3, 0.5, { hz: 1400, hzTo: 1200 });
    },
    start: (E, t) => { // фанфара старта
      [74, 81, 86].forEach((n, i) => voicePulse(E.ctx, E.sfxBus, n, t + i * 0.1, i === 2 ? 0.26 : 0.11, 0.32, 0.5));
    },
    levelUp: (E, t) => { // новый уровень
      [74, 77, 81, 86].forEach((n, i) => voicePulse(E.ctx, E.sfxBus, n, t + i * 0.065, 0.07, 0.26, 0.25));
    },
    gameOver: (E, t) => { // конец игры — минорный спуск
      [69, 65, 62, 57].forEach((n, i) => voicePulse(E.ctx, E.sfxBus, n, t + i * 0.22, 0.3, 0.24, 0.5));
      voiceTri(E.ctx, E.sfxBus, 45, t, 1.2, 0.22);
    },
    tick: (E, t) => { // щелчок
      voiceNoise(E.ctx, E.sfxBus, t, 0.03, 0.18, { filter: 'highpass', f0: 6000 });
      voicePulse(E.ctx, E.sfxBus, 0, t, 0.035, 0.22, 0.5, { hz: 1900 });
    },
    pause: (E, t) => { // пауза
      voicePulse(E.ctx, E.sfxBus, 0, t, 0.05, 0.3, 0.5, { hz: 920, hzTo: 700 });
      voicePulse(E.ctx, E.sfxBus, 0, t + 0.09, 0.06, 0.3, 0.5, { hz: 700, hzTo: 520 });
    },
    bonus: (E, t) => { // «монетка»
      voicePulse(E.ctx, E.sfxBus, 83, t, 0.06, 0.3, 0.5);
      voicePulse(E.ctx, E.sfxBus, 88, t + 0.075, 0.14, 0.3, 0.5);
    },
  };
  /* ================= 7. Фасад window.Chiptune ================= */

  let solo = null; // живой движок; контекст создаётся только в init()
  const pending = { volume: 1, muted: false, paused: false, track: null };
  function makeLive() {
    const AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    solo = new Engine(new AC());
    // Настройки, выставленные до первого жеста, применяем сразу.
    if (pending.volume !== 1) solo.setVolume(pending.volume);
    if (pending.muted) solo.setMuted(true);
    if (pending.track) { const tr = pending.track; pending.track = null; solo.startMusic(tr); }
    if (pending.paused) solo.setPaused(true);
    return solo;
  }
  const Chiptune = {
    // Лениво создаёт/возобновляет контекст; безопасно вызывать много раз.
    init: function () {
      try {
        if (!solo) makeLive();
        const ctx = solo && solo.ctx;
        if (ctx && ctx.state === 'suspended' && ctx.resume) ctx.resume().catch(() => {});
        return ctx || null;
      } catch (e) {
        if (global.console && global.console.warn) global.console.warn('audio.js: init', e);
        return null;
      }
    },
    // Движок на произвольном BaseAudioContext (в т.ч. OfflineAudioContext).
    create: (baseCtx) => new Engine(baseCtx),
    startMusic: (name) => { if (solo) solo.startMusic(name); else pending.track = name; },
    stopMusic: (fadeSec) => { if (solo) solo.stopMusic(fadeSec); },
    sfx: (name) => { if (solo) solo.sfx(name); },
    setMuted: (m) => { pending.muted = !!m; if (solo) solo.setMuted(m); },
    isMuted: () => (solo ? solo.muted : pending.muted),
    setVolume: (v) => {
      pending.volume = clamp(Number(v) || 0, 0, 1);
      if (solo) solo.setVolume(v);
    },
    getVolume: () => (solo ? solo.volume : pending.volume),
    setPaused: (p) => { pending.paused = !!p; if (solo) solo.setPaused(p); },
    isPaused: () => (solo ? solo.paused : pending.paused),
  };
  global.Chiptune = Chiptune;
})(typeof window !== 'undefined' ? window : this);

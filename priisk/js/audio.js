/* ПРИИСК · js/audio.js — процедурные звуки мира (WebAudio, без файлов) поверх звука движка Гефест Arcade.
   Гейзер (нарастающее шипение → выброс пара), взрыв заряда / здания / провала (низкий удар + обломки), клеть (скрип троса,
   лязг створки), буровая вышка (ритмичный стук). Контекст — g.audio._ctx() движка: до первого жеста звуков нет (политика
   автоплея), выключенный звук (M) — тишина. Громкость — порядка g.audio.beep (пики 0.05–0.12), общий узел master.

   var A = PRIISK.audio.install(g);   // один раз, после createGame
   A.geyserRise(sec, vol)  — шипение с нарастанием на sec секунд (предупреждение перед выбросом)
   A.geyser(vol)           — выброс: удар пара + шипящий хвост
   A.blast(big, vol)       — взрыв: низкий удар (синус со спадом частоты) + шум + стук обломков
   A.debris(vol)           — обломки / осыпь (провал, падение вагонетки)
   A.cageCreak(vol)        — скрип троса клети;  A.cageClank(vol) — лязг створки / удар клети о площадку
   A.rigKnock(vol)         — один удар бура (ритм задаёт main.js)
   A.stats                 — { made, errors } — для тестов (сколько звуков создано, сколько упало с ошибкой)
   vol — множитель громкости (0…1, по умолчанию 1; main.js приглушает далёкие источники). */
(function (global) {
  'use strict';
  var P = global.PRIISK = global.PRIISK || {};
  var MASTER = 0.9; // общий уровень SFX ПРИИСКА относительно beep() движка

  function install(g) {
    var A = { stats: { made: 0, errors: 0 } }, bus = null, busCtx = null, noise = null, noiseCtx = null, last = {};
    function ctx() { if (!g.audio || !g.audio.enabled) return null; var ac = g.audio._ctx ? g.audio._ctx() : g.audio.ac; return ac || null; }
    function out(ac) { if (bus && busCtx === ac) return bus; bus = ac.createGain(); bus.gain.value = MASTER; bus.connect(ac.destination); busCtx = ac; return bus; }
    function noiseBuf(ac) { // 2 с белого шума, на контекст — один раз
      if (noise && noiseCtx === ac) return noise;
      var n = Math.floor((ac.sampleRate || 44100) * 2), b = ac.createBuffer(1, n, ac.sampleRate || 44100), d = b.getChannelData(0), s = 12345;
      for (var i = 0; i < n; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; d[i] = s / 0x3fffffff - 1; }
      noise = b; noiseCtx = ac; return b;
    }
    // троттлинг: один и тот же звук не чаще ms (частые события не превращаются в кашу)
    function gap(k, ms) { var t = Date.now(); if (t - (last[k] || 0) < ms) return false; last[k] = t; return true; }
    function play(k, ms, fn) {
      if (!gap(k, ms)) return false; var ac = ctx(); if (!ac) return false;
      try { fn(ac, out(ac), ac.currentTime); A.stats.made++; return true; } catch (e) { A.stats.errors++; return false; }
    }
    function v(x) { return Math.max(0.0001, x); }
    // шум через фильтр с огибающей: { type, f0, f1, q, a (атака), d (длительность), peak, off (смещение в буфере) }
    function hiss(ac, dst, t, o) {
      var src = ac.createBufferSource(), f = ac.createBiquadFilter(), gn = ac.createGain();
      src.buffer = noiseBuf(ac); src.loop = true;
      f.type = o.type || 'bandpass'; f.Q.value = o.q || 1;
      f.frequency.setValueAtTime(o.f0, t); if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + o.d);
      gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(v(o.peak), t + (o.a || 0.01));
      if (o.hold) gn.gain.setValueAtTime(v(o.peak), t + o.a + o.hold);
      gn.gain.exponentialRampToValueAtTime(0.0001, t + o.d);
      src.connect(f); f.connect(gn); gn.connect(dst); src.start(t, o.off || 0); src.stop(t + o.d + 0.05);
    }
    // тональный удар: осциллятор со спадом частоты f0 → f1 за d
    function thump(ac, dst, t, o) {
      var os = ac.createOscillator(), gn = ac.createGain();
      os.type = o.type || 'sine'; os.frequency.setValueAtTime(o.f0, t); os.frequency.exponentialRampToValueAtTime(v(o.f1 || o.f0 / 3), t + o.d);
      gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(v(o.peak), t + (o.a || 0.005)); gn.gain.exponentialRampToValueAtTime(0.0001, t + o.d);
      os.connect(gn); gn.connect(dst); os.start(t); os.stop(t + o.d + 0.05);
    }

    A.geyserRise = function (sec, vol) {
      sec = Math.max(0.4, Math.min(6, sec || 2.5)); vol = vol == null ? 1 : vol;
      return play('gRise', 800, function (ac, dst, t) {
        hiss(ac, dst, t, { type: 'bandpass', f0: 500, f1: 2600, q: 0.9, a: sec * 0.9, d: sec + 0.15, peak: 0.05 * vol });   // нарастающее шипение
        hiss(ac, dst, t, { type: 'lowpass', f0: 160, f1: 420, q: 4, a: sec * 0.8, d: sec + 0.1, peak: 0.035 * vol, off: 0.7 }); // гул снизу
      });
    };
    A.geyser = function (vol) {
      vol = vol == null ? 1 : vol;
      return play('geyser', 350, function (ac, dst, t) {
        thump(ac, dst, t, { f0: 140, f1: 45, d: 0.35, peak: 0.09 * vol });                                                   // выброс — удар
        hiss(ac, dst, t, { type: 'highpass', f0: 1200, f1: 3500, q: 0.7, a: 0.03, hold: 0.25, d: 1.6, peak: 0.07 * vol });    // пар
        hiss(ac, dst, t + 0.05, { type: 'bandpass', f0: 900, f1: 300, q: 1.2, a: 0.05, d: 1.2, peak: 0.04 * vol, off: 0.4 }); // хвост
      });
    };
    function rubble(ac, dst, t, n, vol) { // стук обломков: короткие щелчки шума со случайными задержками и высотой
      for (var i = 0; i < n; i++) { var dt = 0.08 + Math.random() * 0.6 + i * 0.03;
        hiss(ac, dst, t + dt, { type: 'bandpass', f0: 600 + Math.random() * 1800, q: 6, a: 0.003, d: 0.05 + Math.random() * 0.06, peak: (0.025 + Math.random() * 0.025) * vol, off: Math.random() * 1.5 }); }
    }
    A.blast = function (big, vol) {
      vol = vol == null ? 1 : vol; var k = big ? 1 : 0.6;
      return play(big ? 'blastB' : 'blastS', big ? 120 : 70, function (ac, dst, t) {
        thump(ac, dst, t, { f0: big ? 110 : 160, f1: big ? 32 : 50, d: big ? 0.7 : 0.35, peak: 0.12 * k * vol });                 // низкий удар
        hiss(ac, dst, t, { type: 'lowpass', f0: big ? 1800 : 2500, f1: 200, q: 0.8, a: 0.004, d: big ? 0.9 : 0.4, peak: 0.08 * k * vol }); // взрывная волна
        rubble(ac, dst, t, big ? 9 : 4, k * vol);
      });
    };
    A.debris = function (vol) {
      vol = vol == null ? 1 : vol;
      return play('debris', 200, function (ac, dst, t) {
        thump(ac, dst, t, { f0: 90, f1: 40, d: 0.4, peak: 0.06 * vol });
        hiss(ac, dst, t, { type: 'lowpass', f0: 900, f1: 250, q: 0.7, a: 0.02, d: 0.8, peak: 0.04 * vol });
        rubble(ac, dst, t, 12, vol);
      });
    };
    A.cageCreak = function (vol) {
      vol = vol == null ? 1 : vol;
      return play('creak', 450, function (ac, dst, t) { // скрип троса: пила через узкий фильтр с «плавающей» высотой
        var os = ac.createOscillator(), f = ac.createBiquadFilter(), gn = ac.createGain(), base = 300 + Math.random() * 80;
        os.type = 'sawtooth'; os.frequency.setValueAtTime(base, t); os.frequency.linearRampToValueAtTime(base * 1.35, t + 0.18); os.frequency.linearRampToValueAtTime(base * 1.1, t + 0.4);
        f.type = 'bandpass'; f.Q.value = 9; f.frequency.setValueAtTime(1300, t); f.frequency.linearRampToValueAtTime(1800, t + 0.3);
        gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(v(0.05 * vol), t + 0.06); gn.gain.exponentialRampToValueAtTime(v(0.02 * vol), t + 0.25); gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
        os.connect(f); f.connect(gn); gn.connect(dst); os.start(t); os.stop(t + 0.5);
      });
    };
    A.cageClank = function (vol) {
      vol = vol == null ? 1 : vol;
      return play('clank', 150, function (ac, dst, t) { // лязг: два негармоничных «металлических» тона + щелчок шума
        [[523, 0.05], [1397, 0.03], [2093, 0.018]].forEach(function (p) { thump(ac, dst, t, { type: 'square', f0: p[0], f1: p[0] * 0.97, d: 0.22, peak: p[1] * vol }); });
        hiss(ac, dst, t, { type: 'highpass', f0: 3000, q: 0.7, a: 0.002, d: 0.06, peak: 0.05 * vol });
        thump(ac, dst, t + 0.01, { f0: 120, f1: 60, d: 0.15, peak: 0.05 * vol });
      });
    };
    A.rigKnock = function (vol) {
      vol = vol == null ? 1 : vol;
      return play('rig', 120, function (ac, dst, t) { // удар бура: глухой «тук» + короткий металлический призвук
        thump(ac, dst, t, { f0: 95, f1: 55, d: 0.12, peak: 0.07 * vol });
        hiss(ac, dst, t, { type: 'bandpass', f0: 700, q: 3, a: 0.002, d: 0.05, peak: 0.03 * vol });
        thump(ac, dst, t, { type: 'triangle', f0: 880, f1: 820, d: 0.06, peak: 0.012 * vol });
      });
    };
    return A;
  }
  P.audio = { install: install };
})(typeof window !== 'undefined' ? window : globalThis);

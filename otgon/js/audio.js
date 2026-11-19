/* ОТГОН · звук. SFX поверх g.audio.beep движка и «живые» звуки на WebAudio: свист подпаска (скользящий тон),
   голоса стада (мягкое «у-у» треугольником), шум ветра в буран, плеск реки, раскат грома (шум через НЧ-фильтр).
   OTGON.sfx(g, type, data) — события логики; OTGON.ambience(g, state, dt) — каждый кадр в play. */
(function (global) {
  'use strict';
  var O = global.OTGON = global.OTGON || {};

  function seq(g, notes) { notes.forEach(function (n) { var p = function () { g.audio.beep(n[0], n[1], n[2], n[3]); }; if (n[4]) setTimeout(p, n[4]); else p(); }); }
  function live(g) { var a = g.audio; return a && a.enabled && a.unlocked && a.ac; }
  var nbuf = null, nctx = null;
  function noise(ac) {
    if (nbuf && nctx === ac) return nbuf;
    var len = Math.floor(ac.sampleRate * 0.5), b = ac.createBuffer(1, len, ac.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    nbuf = b; nctx = ac; return b;
  }
  function burst(g, f, q, dur, vol, type) {
    var ac = live(g); if (!ac) return;
    try {
      var n = ac.createBufferSource(), fl = ac.createBiquadFilter(), gn = ac.createGain(), t = ac.currentTime;
      n.buffer = noise(ac); n.loop = true; fl.type = type || 'bandpass'; fl.frequency.value = f; fl.Q.value = q;
      gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(vol, t + Math.min(0.05, dur * 0.3)); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      n.connect(fl); fl.connect(gn); gn.connect(ac.destination); n.start(t); n.stop(t + dur + 0.05);
    } catch (e) {}
  }
  // скользящий тон: f0 → f1 за dur
  function glide(g, f0, f1, dur, vol, type, delay) {
    var ac = live(g); if (!ac) return;
    try {
      var o = ac.createOscillator(), gn = ac.createGain(), t = ac.currentTime + (delay || 0);
      o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f1, t + dur);
      gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(vol, t + 0.03); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(gn); gn.connect(ac.destination); o.start(t); o.stop(t + dur + 0.05);
    } catch (e) {}
  }
  function voice(g, pitch, vol) { var f = 250 * pitch; glide(g, f, f * 1.22, 0.16, vol, 'triangle'); glide(g, f * 1.2, f * 0.92, 0.26, vol * 0.8, 'triangle', 0.15); }

  var bleatT = 2, windT = 0, riverT = 0, rainT = 0;
  O.ambience = function (g, S, dt) {
    if (!live(g) || S.phase !== 'play') return;
    var Lg = O.logic, l = Lg.LEGS[S.lv], h = S.hero, n = 0, mv = 0;
    S.herd.forEach(function (c) { if (c.st === 'ok') { n++; if (Math.abs(c.vx) + Math.abs(c.vy) > 12) mv++; } });
    bleatT -= dt * (0.5 + mv / Math.max(1, n));
    if (bleatT <= 0 && n) { bleatT = 2.5 + Math.random() * 4; voice(g, 0.85 + Math.random() * 0.5, 0.022); }
    var bl = Lg.zoneK(l.bliz, h.x); windT -= dt;
    if (bl > 0 && windT <= 0) { windT = 0.7; burst(g, 500 + Math.random() * 500, 0.6, 1.2, 0.03 * bl); }
    var r = Lg.riverAt(l, h.x, 260); riverT -= dt;
    if (r && riverT <= 0) { riverT = 0.5; burst(g, 1100, 0.5, 0.8, 0.014); }
    var st = Lg.zoneK(l.storm, h.x); rainT -= dt;
    if ((l.rain || st > 0) && rainT <= 0) { rainT = 0.6; burst(g, 3600, 0.4, 0.9, l.rain ? 0.008 : 0.012 * st); }
  };

  O.sfx = function (g, type, d) {
    d = d || {};
    switch (type) {
      case 'whistle': glide(g, 1250, 1900, 0.2, 0.05); glide(g, 1900, 1500, 0.22, 0.045, 'sine', 0.2); break;
      case 'staff': burst(g, 220, 1.4, 0.12, 0.08); g.audio.beep(170, 0.06, 'triangle', 0.05); break;
      case 'bolt': voice(g, 1.7, 0.04); break;
      case 'balk': glide(g, 170, 130, 0.22, 0.035, 'triangle'); break;
      case 'bird': glide(g, 1500, 900, 0.3, 0.03, 'sawtooth'); glide(g, 1400, 850, 0.28, 0.025, 'sawtooth', 0.4); break;
      case 'dive': glide(g, 1700, 600, 0.45, 0.035, 'sawtooth'); break;
      case 'swoop': burst(g, 900, 0.7, 0.3, 0.06); break;
      case 'shoo': glide(g, 900, 1500, 0.2, 0.025, 'sawtooth'); burst(g, 1400, 0.6, 0.35, 0.03); break;
      case 'charge': seq(g, [[1900, 0.03, 'square', 0.012], [2300, 0.03, 'square', 0.012, 120], [2100, 0.03, 'square', 0.012, 260], [2500, 0.03, 'square', 0.012, 420]]); break;
      case 'thunder': burst(g, 160, 0.5, 1.6, 0.16, 'lowpass'); burst(g, 2400, 0.6, 0.15, 0.06); break;
      case 'lost': seq(g, [[392, 0.18, 'triangle', 0.05], [330, 0.2, 'triangle', 0.05, 200], [262, 0.34, 'triangle', 0.05, 420]]); break;
      case 'checkpoint': seq(g, [[784, 0.06, 'triangle', 0.035], [988, 0.1, 'triangle', 0.035, 80]]); break;
      case 'camp': seq(g, [[392, 0.14, 'triangle', 0.05], [494, 0.14, 'triangle', 0.05, 150], [587, 0.14, 'triangle', 0.05, 300], [784, 0.3, 'triangle', 0.05, 450]]); break;
      case 'leg': seq(g, [[523, 0.1, 'triangle', 0.04], [659, 0.16, 'triangle', 0.04, 120]]); break;
      case 'mark': g.audio.beep(660, 0.05, 'triangle', 0.04); break;
      case 'alone': seq(g, [[294, 0.22, 'triangle', 0.05], [247, 0.22, 'triangle', 0.05, 240], [196, 0.4, 'triangle', 0.05, 480]]); break;
      case 'win': seq(g, [[392, 0.14, 'triangle', 0.06], [494, 0.14, 'triangle', 0.06, 140], [587, 0.14, 'triangle', 0.06, 280], [784, 0.2, 'triangle', 0.06, 420], [988, 0.4, 'triangle', 0.06, 620]]); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);

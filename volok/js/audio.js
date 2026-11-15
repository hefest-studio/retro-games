/* ВОЛОК · звук. SFX поверх g.audio.beep движка и «живой» звук машины на WebAudio:
   пыхтение котла (шумовой «чух» с полосовым фильтром, темп — от скорости и режима хода),
   скрип сруба (редкий треугольный «стон» на ходу), шипение пара (клапан, течь).
   VOLOK.sfx(g, type, data) — события логики; VOLOK.machineSound(g, state, dt) — каждый кадр в play. */
(function (global) {
  'use strict';
  var V = global.VOLOK = global.VOLOK || {};

  function seq(g, notes) {
    notes.forEach(function (n) { var p = function () { g.audio.beep(n[0], n[1], n[2], n[3]); }; if (n[4]) setTimeout(p, n[4]); else p(); });
  }
  function live(g) { var a = g.audio; return a && a.enabled && a.unlocked && a.ac; }
  var nbuf = null, nctx = null;
  function noise(ac) {
    if (nbuf && nctx === ac) return nbuf;
    var len = Math.floor(ac.sampleRate * 0.4), b = ac.createBuffer(1, len, ac.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    nbuf = b; nctx = ac; return b;
  }
  // шумовой всплеск: f — центр фильтра, q — добротность, dur, vol
  function burst(g, f, q, dur, vol) {
    var ac = live(g); if (!ac) return;
    try {
      var n = ac.createBufferSource(), fl = ac.createBiquadFilter(), gn = ac.createGain(), t = ac.currentTime;
      n.buffer = noise(ac); fl.type = 'bandpass'; fl.frequency.value = f; fl.Q.value = q;
      gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(vol, t + 0.02); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      n.connect(fl); fl.connect(gn); gn.connect(ac.destination); n.start(t); n.stop(t + dur + 0.05);
    } catch (e) {}
  }
  function creak(g) {
    var ac = live(g); if (!ac) return;
    try {
      var o = ac.createOscillator(), gn = ac.createGain(), t = ac.currentTime, f = 180 + Math.random() * 120;
      o.type = 'triangle'; o.frequency.setValueAtTime(f, t); o.frequency.linearRampToValueAtTime(f * 1.35, t + 0.35);
      gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(0.018, t + 0.08); gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      o.connect(gn); gn.connect(ac.destination); o.start(t); o.stop(t + 0.5);
    } catch (e) {}
  }

  var puffT = 0, creakT = 3, hissT = 0;
  V.machineSound = function (g, S, dt) {
    if (!live(g) || S.phase === 'won') return;
    var sp = Math.abs(S.v), sub = S.depth > 0.6;
    // пыхтение: при стоянке — редкое и тихое, на ходу — чаще
    var rate = S.F > 0 ? 0.55 + sp / 22 + S.mode * 0.4 : 0;
    puffT -= dt * rate;
    if (rate && puffT <= 0) { puffT = 1; burst(g, sub ? 260 : 420 + S.P * 2, 1.6, 0.16, 0.035 + Math.min(0.03, sp / 2000)); }
    if (sp > 6 && !S.water) { creakT -= dt * (0.4 + sp / 80); if (creakT <= 0) { creakT = 2 + Math.random() * 4; creak(g); } }
    if (S.water && sp > 4 && Math.random() < dt * 0.6) burst(g, 700, 0.7, 0.3, 0.01);        // плеск колеса
    hissT -= dt;
    if (hissT <= 0 && (S.leaks.length || S.P >= 97)) { hissT = 0.5; burst(g, 3200, 0.8, 0.35, S.P >= 97 ? 0.03 : 0.018); }
  };

  V.sfx = function (g, type, d) {
    d = d || {};
    switch (type) {
      case 'pick': case 'unstow': seq(g, [[330, 0.05, 'triangle', 0.05], [440, 0.06, 'triangle', 0.05, 50]]); break;
      case 'stow': g.audio.beep(220, 0.07, 'triangle', 0.05); break;
      case 'feed': burst(g, 300, 0.8, 0.4, 0.06); seq(g, [[160, 0.12, 'triangle', 0.05]]); break;
      case 'lever': seq(g, [[520 + d.mode * 120, 0.05, 'square', 0.035], [260, 0.04, 'triangle', 0.04, 40]]); break;
      case 'sail': seq(g, d.up ? [[392, 0.08, 'triangle', 0.05], [523, 0.12, 'triangle', 0.05, 80]] : [[523, 0.08, 'triangle', 0.05], [392, 0.12, 'triangle', 0.05, 80]]); break;
      case 'vent': if (Math.random() < 0.08) burst(g, 2600, 0.6, 0.25, 0.04); break;
      case 'crank': if (Math.random() < 0.12) g.audio.beep(d.steam ? 140 : 110, 0.04, 'square', 0.025); break;
      case 'gateOpen': case 'built': case 'mastFixed': seq(g, [[392, 0.1, 'triangle', 0.06], [494, 0.1, 'triangle', 0.06, 110], [587, 0.2, 'triangle', 0.06, 220]]); break;
      case 'launch': burst(g, 500, 0.5, 0.9, 0.08); seq(g, [[294, 0.15, 'triangle', 0.06], [370, 0.15, 'triangle', 0.06, 160], [440, 0.15, 'triangle', 0.06, 320], [587, 0.35, 'triangle', 0.07, 480]]); break;
      case 'crafted': seq(g, [[880, 0.04, 'square', 0.03], [880, 0.04, 'square', 0.03, 120], [1175, 0.08, 'triangle', 0.04, 240]]); break;
      case 'patched': case 'extinguish': burst(g, 1800, 0.7, 0.3, 0.04); g.audio.beep(660, 0.08, 'triangle', 0.04); break;
      case 'leak': case 'break': burst(g, 3000, 0.9, 0.6, 0.05); g.audio.beep(180, 0.15, 'sawtooth', 0.03); break;
      case 'fire': case 'overheat': seq(g, [[220, 0.15, 'sawtooth', 0.05], [208, 0.15, 'sawtooth', 0.05, 180], [196, 0.25, 'sawtooth', 0.05, 360]]); break;
      case 'bump': burst(g, 140, 1.2, 0.3, 0.09); g.audio.beep(90, 0.15, 'triangle', 0.08); break;
      case 'splash': burst(g, 900, 0.5, 0.6, 0.08); break;
      case 'mast': burst(g, 200, 0.7, 0.5, 0.1); g.audio.beep(110, 0.3, 'sawtooth', 0.05); break;
      case 'ballast': burst(g, d.dive ? 400 : 900, 0.6, 0.8, 0.05); break;
      case 'nope': g.audio.beep(150, 0.06, 'square', 0.03); break;
      case 'checkpoint': seq(g, [[784, 0.06, 'triangle', 0.035], [988, 0.1, 'triangle', 0.035, 80]]); break;
      case 'wreck': seq(g, [[196, 0.2, 'sawtooth', 0.06], [147, 0.3, 'sawtooth', 0.06, 200]]); break;
      case 'choke': seq(g, [[300, 0.2, 'triangle', 0.05], [200, 0.3, 'triangle', 0.05, 200]]); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);

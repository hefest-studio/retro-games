/* КАМЕРТОН · звук среды без слов: звон камертона, тиканье пружин, шаги по брусчатке, скрип воротов, удары молотов.
   Всё синтезируется на WebAudio движка (g.audio.ac) после первого жеста; при выключенном звуке — тишина.
   KAMER.sfx(g, type, d) — события логики; KAMER.ambience(g, S, dt) — фон зоны каждый кадр (часы, ветер в проводах). */
(function (global) {
  'use strict';
  var K = global.KAMER = global.KAMER || {};
  function live(g) { var a = g.audio; return a && a.enabled && a.unlocked && a.ac ? a.ac : null; }
  var nbuf = null, nctx = null;
  function noise(ac) {
    if (nbuf && nctx === ac) return nbuf;
    var len = Math.floor(ac.sampleRate * 1.0), b = ac.createBuffer(1, len, ac.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    nbuf = b; nctx = ac; return b;
  }
  function burst(g, f, q, dur, vol, f2, delay) {
    var ac = live(g); if (!ac) return;
    try {
      var n = ac.createBufferSource(), fl = ac.createBiquadFilter(), gn = ac.createGain(), t = ac.currentTime + (delay || 0);
      n.buffer = noise(ac); fl.type = 'bandpass'; fl.Q.value = q; fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.linearRampToValueAtTime(f2, t + dur);
      gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(vol, t + Math.min(0.02, dur * 0.3)); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      n.connect(fl); fl.connect(gn); gn.connect(ac.destination); n.start(t, Math.random() * 0.5); n.stop(t + dur + 0.05);
    } catch (e) {}
  }
  function tone(g, f, f2, dur, vol, type, delay) {
    var ac = live(g); if (!ac) return;
    try {
      var o = ac.createOscillator(), gn = ac.createGain(), t = ac.currentTime + (delay || 0);
      o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
      gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(vol, t + 0.012); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(gn); gn.connect(ac.destination); o.start(t); o.stop(t + dur + 0.05);
    } catch (e) {}
  }
  // чистый звон камертона: основной тон + слабая октава, долгий хвост
  function fork(g, f, vol) { tone(g, f, 0, 1.4, vol, 'sine'); tone(g, f * 2.01, 0, 0.5, vol * 0.25, 'sine'); }
  K.sfx = function (g, type, d) {
    d = d || {};
    switch (type) {
      case 'step': if (d.kind === 'giant') { burst(g, 120, 0.8, 0.22, 0.07); tone(g, 70, 50, 0.25, 0.05, 'triangle'); }
        else if (d.kind === 'hero') burst(g, 1400 + Math.random() * 600, 1.8, 0.05, 0.02);
        else { burst(g, 2600 + Math.random() * 900, 4, 0.03, 0.015); tone(g, 2400 + Math.random() * 300, 0, 0.03, 0.008, 'square'); } break;   // куклы — металлическое «цок»
      case 'jump': burst(g, 700, 0.9, 0.08, 0.02, 1500); if (d.id !== 'hero') tone(g, 900, 1500, 0.12, 0.02, 'triangle'); break;
      case 'land': burst(g, d.kind === 'giant' ? 90 : 220, 0.8, 0.14, d.kind === 'giant' ? 0.09 : 0.045); break;
      case 'attune': fork(g, 440, 0.06); tone(g, 660, 0, 0.9, 0.025, 'sine', 0.12); burst(g, 5200, 6, 0.3, 0.01); break;
      case 'switch': fork(g, d.to === 'hero' ? 392 : 523, 0.035); break;
      case 'unlink': tone(g, 523, 330, 0.45, 0.04, 'sine'); burst(g, 3000, 3, 0.1, 0.015); break;
      case 'lever': tone(g, 180, 120, 0.12, 0.05, 'square'); burst(g, 900, 2, 0.12, 0.03); break;
      case 'grab': for (var k = 0; k < 4; k++) burst(g, 1200 + k * 120, 5, 0.04, 0.02, 0, k * 0.07); break;   // трещотка ворота
      case 'release': burst(g, 800, 2, 0.1, 0.02); break;
      case 'door': burst(g, 300, 1.2, 0.45, 0.04, d.open ? 600 : 200); tone(g, 90, 70, 0.3, 0.03, 'triangle'); break;
      case 'plateOn': tone(g, 220, 0, 0.09, 0.04, 'square'); burst(g, 500, 1.5, 0.08, 0.03); break;
      case 'plateOff': tone(g, 180, 0, 0.07, 0.03, 'square'); break;
      case 'liftStop': burst(g, 260, 1, 0.2, 0.04); break;
      case 'slam': burst(g, 110, 0.7, 0.3, 0.09); tone(g, 60, 40, 0.3, 0.06, 'triangle'); burst(g, 2400, 2, 0.08, 0.02); break;
      case 'rumble': for (var r = 0; r < 6; r++) tone(g, 70 + r * 3, 60, 0.4, 0.05, 'triangle', r * 0.25); break;
      case 'drumFall': burst(g, 150, 0.7, 0.8, 0.08, 60); for (var q = 0; q < 5; q++) tone(g, 880 + q * 110, 0, 0.3, 0.015, 'triangle', 0.3 + q * 0.09); break;
      case 'thud': burst(g, 140, 0.9, 0.2, 0.07); break;
      case 'ladder': case 'rung': burst(g, 900, 3, 0.04, 0.02); break;
      case 'death': for (var s = 0; s < 6; s++) tone(g, 880 - s * 90, 0, 0.12, 0.03 * (1 - s / 7), 'triangle', s * (0.09 + s * 0.04)); burst(g, 3200, 3, 0.4, 0.015, 600); break;   // тиканье замедляется и стихает
      case 'respawn': fork(g, 349, 0.035); break;
      case 'checkpoint': tone(g, 784, 0, 0.6, 0.025, 'sine'); tone(g, 1175, 0, 0.5, 0.012, 'sine', 0.1); break;   // фонарик зажёгся
      case 'zoneEnd': fork(g, 294, 0.04); fork(g, 440, 0.03); break;
      case 'zone': burst(g, 400, 0.6, 1.2, 0.02, 200); break;
      case 'reset': burst(g, 600, 1, 0.3, 0.03, 200); break;
      case 'win': [523, 659, 784, 1047].forEach(function (f, i) { fork(g, f, 0.035); tone(g, f / 2, 0, 1.2, 0.02, 'triangle', i * 0.3); }); break;
      default: break;
    }
  };
  // фон: тиканье далёких часов, у каждой зоны — свой шаг; ветер
  var amb = { t: 0, w: 0 };
  var TICK = [0.75, 0.6, 0.5, 1.2, 0.4, 0.9];
  K.ambience = function (g, S, dt) {
    if (!live(g) || !S || S.dead) return;
    amb.t -= dt; amb.w -= dt;
    if (amb.t <= 0) { amb.t = TICK[S.z] || 0.75; burst(g, 4200, 8, 0.02, 0.006); }
    if (amb.w <= 0) { amb.w = 4 + Math.random() * 5; burst(g, 500 + Math.random() * 300, 0.5, 2.5, 0.008, 300); }
  };
  K.stopAmbience = function () { amb.t = 0.5; amb.w = 2; };
})(typeof window !== 'undefined' ? window : globalThis);

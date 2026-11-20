/* ПОЛУУСТАВ · звук среды без слов: шаги пера (шорох по бумаге), скрип страниц, плеск, щелчки механизмов.
   Всё синтезируется на WebAudio движка (g.audio.ac) после первого жеста; при выключенном звуке — тишина.
   POLU.sfx(g, type, d) — события логики; POLU.ambience(g, S, dt) — фон страницы каждый кадр (ветер, вода, мельница). */
(function (global) {
  'use strict';
  var P = global.POLU = global.POLU || {};
  function live(g) { var a = g.audio; return a && a.enabled && a.unlocked && a.ac ? a.ac : null; }
  var nbuf = null, nctx = null;
  function noise(ac) {
    if (nbuf && nctx === ac) return nbuf;
    var len = Math.floor(ac.sampleRate * 1.0), b = ac.createBuffer(1, len, ac.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    nbuf = b; nctx = ac; return b;
  }
  // шумовой мазок: полосовой фильтр f→f2, длительность, громкость, задержка
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
      gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(vol, t + 0.015); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(gn); gn.connect(ac.destination); o.start(t); o.stop(t + dur + 0.05);
    } catch (e) {}
  }
  P.sfx = function (g, type, d) {
    d = d || {};
    switch (type) {
      case 'step': burst(g, 3200 + Math.random() * 1400, 2.5, d.push ? 0.16 : 0.045, d.push ? 0.03 : 0.018); if (d.push) burst(g, 260, 1.2, 0.2, 0.03); break;   // перо скребёт бумагу
      case 'jump': burst(g, 900, 0.9, 0.09, 0.025, 1800); break;
      case 'land': burst(g, 240, 0.8, 0.12, 0.05); burst(g, 3000, 2, 0.04, 0.015); break;
      case 'mantle': burst(g, 1800, 1.4, 0.18, 0.02, 2600); break;
      case 'grab': case 'release': tone(g, 210, 160, 0.18, 0.03, 'triangle'); burst(g, 700, 2, 0.1, 0.015); break;
      case 'lever': burst(g, 600, 1.2, 0.06, 0.06); tone(g, 180, 120, 0.12, 0.05, 'triangle', 0.03); break;
      case 'door': tone(g, 150, 230, 0.5, 0.025, 'triangle'); break;
      case 'plateOn': tone(g, 220, 200, 0.12, 0.04, 'triangle'); break;
      case 'splash': burst(g, 900, 0.6, 0.35, 0.05, 300); break;
      case 'thud': burst(g, 180, 0.9, 0.18, d.kind === 'lamp' ? 0.02 : 0.06); break;
      case 'dry': burst(g, 6000, 0.7, 0.5, 0.035, 2500); tone(g, 520, 760, 0.3, 0.02, 'sine', 0.2); break;     // песок шипит, тушь сохнет
      case 'spill': burst(g, 400, 0.7, 1.2, 0.04, 200); tone(g, 120, 70, 0.8, 0.03, 'sine'); break;
      case 'quill': for (var i = 0; i < 4; i++) burst(g, 3600 + i * 300, 3, 0.05, 0.02, null, i * 0.07); break;   // перо дорисовывает мост
      case 'snap': tone(g, 1300, 400, 0.08, 0.05, 'square'); burst(g, 2400, 1, 0.08, 0.04); break;
      case 'creak': tone(g, 140, 210, 0.6, 0.03, 'triangle'); break;
      case 'thump': burst(g, 120, 0.8, 0.35, 0.08); break;
      case 'pick': tone(g, 660, 880, 0.08, 0.03, 'sine'); break;
      case 'drop': tone(g, 440, 330, 0.08, 0.03, 'sine'); break;
      case 'throw': burst(g, 1200, 1, 0.15, 0.02, 2400); break;
      case 'death': tone(g, 320, 70, 0.5, 0.05, 'sine'); burst(g, 500, 0.8, 0.4, 0.04, 150); break;          // клякса
      case 'respawn': for (var k = 0; k < 3; k++) burst(g, 3800, 3, 0.05, 0.016, null, k * 0.09); break;
      case 'checkpoint': tone(g, 880, 870, 0.9, 0.018, 'sine'); tone(g, 1320, 1310, 0.7, 0.008, 'sine', 0.05); break;
      case 'page': burst(g, 1200, 0.8, 0.35, 0.05, 3200); burst(g, 2400, 0.9, 0.3, 0.04, 900, 0.32); break;   // шорох листа
      case 'reset': burst(g, 1500, 0.8, 0.25, 0.03, 3000); break;
      case 'win': tone(g, 440, 440, 1.2, 0.03, 'sine'); tone(g, 660, 660, 1.2, 0.02, 'sine', 0.3); tone(g, 880, 880, 1.6, 0.015, 'sine', 0.6); break;
    }
  };
  // фон: тихий ветер (полосовой шум с медленным колебанием); на реке — плеск; на мельнице — стук колеса
  var amb = null, beat = 0;
  P.ambience = function (g, S, dt) {
    var ac = live(g);
    if (!ac) { if (amb) { try { amb.gn.gain.value = 0; } catch (e) {} } return; }
    if (!amb || amb.ac !== ac) {
      try {
        var n = ac.createBufferSource(), fl = ac.createBiquadFilter(), gn = ac.createGain();
        n.buffer = noise(ac); n.loop = true; fl.type = 'bandpass'; fl.frequency.value = 500; fl.Q.value = 0.6; gn.gain.value = 0;
        n.connect(fl); fl.connect(gn); gn.connect(ac.destination); n.start();
        amb = { ac: ac, n: n, fl: fl, gn: gn, t: 0 };
      } catch (e) { return; }
    }
    amb.t += dt; var m = S.L.motif, base = m === 'river' ? 0.012 : m === 'lamp' ? 0.004 : 0.007;
    var want = S.phase === 'play' ? base * (0.6 + 0.4 * Math.sin(amb.t * 0.37) * Math.sin(amb.t * 0.11 + 1)) : 0;
    try { amb.gn.gain.setTargetAtTime(Math.max(0, want), ac.currentTime, 0.3); amb.fl.frequency.setTargetAtTime(m === 'river' ? 700 : 380 + 120 * Math.sin(amb.t * 0.2), ac.currentTime, 0.5); } catch (e) {}
    beat -= dt;
    if (beat <= 0) {
      if (m === 'mill') { beat = 0.9; burst(g, 220, 1.5, 0.08, 0.012); }
      else if (m === 'river') { beat = 0.5 + Math.random() * 1.4; burst(g, 1100 + Math.random() * 600, 2, 0.12, 0.008); }
      else if (m === 'belfry') { beat = 9 + Math.random() * 6; tone(g, 196, 195, 3.5, 0.012, 'sine'); tone(g, 392, 390, 2.5, 0.005, 'sine'); }
      else if (m === 'lamp') { beat = 2 + Math.random() * 3; burst(g, 2500, 4, 0.05, 0.004); }
      else beat = 4 + Math.random() * 4;
    }
  };
  P.stopAmbience = function () { if (amb) { try { amb.gn.gain.value = 0; } catch (e) {} } };
})(typeof window !== 'undefined' ? window : globalThis);

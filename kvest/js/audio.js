/* МАЯЧНИЦА · звук: короткие оригинальные эффекты поверх g.audio.beep движка (WebAudio, без файлов).
   KVEST.sfx(g, name, data) — вызывается из main.js на события движка квеста. Ноты колокольчиков и птиц — одни и те же
   (пентатоника), чтобы мелодию с площади можно было услышать и повторить в маяке. Под водой (глава 4+) колокола-ориентиры
   звучат теми же нотами (событие 'ring': панорама — направление, громкость и срез фильтра — расстояние; высота не меняется). */
(function (global) {
  'use strict';
  var K = global.KVEST = global.KVEST || {};
  var NOTES = [392, 440, 523, 587, 659];   // соль, ля, до, ре, ми — от низкой к высокой
  K.NOTES = NOTES;
  function seq(g, notes, gap, dur, type, vol) { notes.forEach(function (f, i) { if (f) setTimeout(function () { g.audio.beep(f, dur, type, vol); }, i * gap); }); }
  var last = {};
  function rare(name, ms) { var n = Date.now(); if (n - (last[name] || 0) < ms) return false; last[name] = n; return true; }
  // Колокол-ориентир под водой (событие 'ring' движка): нота — строго из NOTES (строй «песни маяка» не меняется: по высоте колокол
  // узнают), панорама d.pan −1..1 — где он (лево/право от героини), расстояние — громкость d.gain и «глухота» (срез ФНЧ d.cutoff).
  // big — большой колокол (октавой ниже, дольше), harsh — лязг железа (негармоничный, короткий: «шум», от которого больно Киту).
  function ring(g, d) {
    var f = (NOTES[d.note] || 523) * (d.big ? 0.5 : 1), vol = 0.085 * (d.gain == null ? 1 : d.gain), dur = d.big ? 1.6 : 1.0;
    var ac = g.audio._ctx ? g.audio._ctx() : null;
    if (!ac || !ac.createBiquadFilter) { g.audio.beep(f, dur * 0.6, 'sine', vol); return; }
    var t0 = ac.currentTime, out = ac.createGain(), lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = d.cutoff || 2400; lp.Q.value = 0.7;
    var pan = ac.createStereoPanner ? ac.createStereoPanner() : null; if (pan) { pan.pan.value = Math.max(-1, Math.min(1, d.pan || 0)); lp.connect(pan); pan.connect(out); } else lp.connect(out);
    out.gain.value = 1; out.connect(ac.destination);
    var parts = d.harsh ? [[1, 1, 'sawtooth'], [1.41, 0.7, 'square'], [2.09, 0.5, 'sawtooth']] : [[1, 1, 'sine'], [2, 0.32, 'sine'], [2.76, 0.18, 'sine'], [0.5, 0.2, 'sine']];
    if (d.harsh) { dur = 0.35; f = 180; vol *= 0.7; }
    parts.forEach(function (q, i) {
      var o = ac.createOscillator(), gg = ac.createGain(); o.type = q[2]; o.frequency.value = f * q[0];
      gg.gain.setValueAtTime(0.0001, t0); gg.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol * q[1]), t0 + 0.012);
      gg.gain.exponentialRampToValueAtTime(0.0001, t0 + dur / (1 + i * 0.6));
      o.connect(gg); gg.connect(lp); o.start(t0); o.stop(t0 + dur + 0.05);
    });
  }
  K.ringVoice = ring;
  K.sfx = function (g, name, d) {
    if (!g.audio.enabled) return;
    d = d || {};
    switch (name) {
      case 'take': seq(g, [660, 880], 60, 0.07, 'triangle', 0.05); break;
      case 'select': g.audio.beep(740, 0.04, 'triangle', 0.035); break;
      case 'push': seq(g, [120, 110, 100], 70, 0.08, 'sawtooth', 0.03); break;
      case 'click': seq(g, [330, 494], 40, 0.04, 'square', 0.035); break;
      case 'clank': seq(g, [196, 147], 50, 0.07, 'square', 0.04); break;
      case 'open': seq(g, [392, 523, 659], 80, 0.09, 'triangle', 0.05); break;
      case 'unlock': seq(g, [880, 660, 988], 60, 0.06, 'square', 0.04); break;
      case 'ok': seq(g, [523, 659, 784], 70, 0.08, 'triangle', 0.05); break;
      case 'nope': if (rare('nope', 200)) seq(g, [220, 185], 70, 0.07, 'triangle', 0.04); break;
      case 'look': if (rare('look', 250)) g.audio.beep(587, 0.05, 'sine', 0.03); break;
      case 'step': g.audio.beep(160, 0.05, 'triangle', 0.03); break;
      case 'wood': seq(g, [180, 140, 200], 60, 0.06, 'square', 0.035); break;
      case 'fire': seq(g, [300, 450, 600, 900], 50, 0.07, 'sawtooth', 0.025); break;
      case 'water': case 'splash': seq(g, [900, 700, 520, 400], 40, 0.06, 'sine', 0.04); break;
      case 'oil': seq(g, [220, 247, 262, 294], 90, 0.1, 'sine', 0.045); break;
      case 'glass': seq(g, [1568, 2093, 2637], 50, 0.08, 'sine', 0.035); break;
      case 'stone': seq(g, [98, 110, 131], 90, 0.12, 'sawtooth', 0.04); break;
      case 'bridge': seq(g, [130, 147, 165, 196, 262], 110, 0.12, 'triangle', 0.05); break;
      case 'goat': seq(g, [330, 311, 330, 294], 70, 0.07, 'sawtooth', 0.025); break;
      case 'cat': seq(g, [700, 900, 760], 80, 0.08, 'triangle', 0.03); break;
      case 'gull': seq(g, [1200, 900, 1300], 70, 0.07, 'square', 0.025); break;
      case 'light': seq(g, [523, 784, 1047], 120, 0.18, 'sine', 0.05); break;
      case 'hint': seq(g, [988, 1319], 70, 0.08, 'sine', 0.04); break;
      case 'page': g.audio.beep(520, 0.04, 'triangle', 0.03); break;
      case 'chime': g.audio.beep(NOTES[d.note] || 523, 0.6, 'sine', 0.07); break;
      case 'birds': [2, 4, 1, 3, 0].forEach(function (n, i) { setTimeout(function () { g.audio.beep(NOTES[n] * 2, 0.16, 'sine', 0.05); setTimeout(function () { g.audio.beep(NOTES[n] * 2, 0.1, 'sine', 0.04); }, 90); }, i * 320); }); break;
      case 'melody': [2, 4, 1, 3, 0].forEach(function (n, i) { setTimeout(function () { g.audio.beep(NOTES[n], 0.5, 'sine', 0.06); }, i * 300); }); break;
      case 'puzzle': seq(g, [659, 784, 988], 90, 0.1, 'triangle', 0.05); break;
      // движок глав: прилив/отлив, ветер, мелкие звери побережья
      case 'tide': seq(g, [196, 220, 247, 220, 196, 175], 140, 0.22, 'sine', 0.03); break;
      case 'wind': seq(g, [880, 830, 784, 740], 110, 0.18, 'sine', 0.02); break;
      case 'crab': if (rare('crab', 300)) seq(g, [1400, 1250, 1400], 45, 0.03, 'square', 0.02); break;
      case 'bark': seq(g, [330, 262, 0, 349, 277], 90, 0.08, 'sawtooth', 0.035); break;
      // помощники: переключение героя, нюх, рытьё, удержание, крылья, мельница, морские птицы
      case 'switch': seq(g, [523, 659], 50, 0.05, 'triangle', 0.035); break;
      case 'sniff': if (rare('sniff', 400)) seq(g, [1100, 0, 1150, 0, 1050], 55, 0.025, 'square', 0.015); break;
      case 'dig': seq(g, [140, 0, 120, 0, 150, 0, 110], 60, 0.05, 'sawtooth', 0.03); break;
      case 'pull': seq(g, [196, 175, 165], 90, 0.12, 'triangle', 0.04); break;
      case 'release': seq(g, [262, 330], 60, 0.06, 'triangle', 0.035); break;
      case 'flap': if (rare('flap', 250)) seq(g, [600, 0, 560, 0, 600], 40, 0.03, 'triangle', 0.02); break;
      case 'mill': seq(g, [110, 123, 110, 98, 110], 160, 0.2, 'sawtooth', 0.02); break;
      case 'terns': if (rare('terns', 500)) seq(g, [1600, 1900, 0, 1700, 2000, 0, 1500], 60, 0.04, 'square', 0.018); break;
      case 'chirp': seq(g, [1800, 2100, 1900], 70, 0.04, 'sine', 0.03); break;
      // под водой: колокола-ориентиры, воздух (пузыри), мягкий возврат, колокол-водолаз, голос Кита
      case 'ring': ring(g, d); break;
      case 'air': seq(g, [700, 900, 1150, 1500], 45, 0.05, 'sine', 0.03); break;
      case 'airlow': if (rare('airlow', 1500)) seq(g, [330, 0, 330], 160, 0.12, 'sine', 0.035); break;
      case 'surface': seq(g, [520, 620, 740, 880, 1040, 1240], 70, 0.09, 'sine', 0.035); break;
      case 'bubbles': if (rare('bubbles', 300)) seq(g, [900, 1200, 1000, 1400, 1100], 55, 0.04, 'sine', 0.025); break;
      case 'dive': seq(g, [262, 220, 196, 165, 147, 131], 150, 0.22, 'sine', 0.04); break;
      case 'clangiron': ring(g, { harsh: true, pan: 0, gain: 0.9, cutoff: 1800 }); break;
      case 'whale': seq(g, [98, 110, 147, 131, 98], 420, 0.6, 'sine', 0.06); seq(g, [196, 220, 294, 262, 196], 420, 0.5, 'triangle', 0.018); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);

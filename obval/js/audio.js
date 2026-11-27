/* ОБВАЛ · звук: стук крепи, треск и грохот обрушения, шаги спасения. Всё синтезируется на WebAudio движка (g.audio.beep) —
   без файлов; при выключенном звуке движок молчит. OBVAL.sfx(g, type, d) */
(function (global) {
  'use strict';
  var OB = global.OBVAL = global.OBVAL || {};
  OB.sfx = function (g, type, d) {
    var b = function (f, t, w, v, delay) { if (delay) setTimeout(function () { g.audio.beep(f, t, w, v); }, delay * 1000); else g.audio.beep(f, t, w, v); };
    if (type === 'place') { b(180, 0.06, 'square', 0.07); b(260, 0.05, 'triangle', 0.05, 0.05); }
    else if (type === 'remove') { b(140, 0.07, 'sawtooth', 0.07); b(90, 0.12, 'square', 0.06, 0.05); }
    else if (type === 'rumble') { b(70, 0.22, 'sawtooth', 0.08); b(55, 0.3, 'square', 0.06, 0.08); b(95, 0.1, 'sawtooth', 0.05, 0.22); }
    else if (type === 'land') b(100, 0.08, 'square', 0.06);
    else if (type === 'save') { b(660, 0.08, 'triangle', 0.06); b(880, 0.1, 'triangle', 0.06, 0.09); }
    else if (type === 'crush' || type === 'fall') { b(120, 0.15, 'sawtooth', 0.08); b(60, 0.25, 'square', 0.07, 0.1); }
    else if (type === 'undo') b(300, 0.06, 'triangle', 0.05);
    else if (type === 'clear') { b(880, 0.12, 'triangle', 0.07); b(1100, 0.12, 'triangle', 0.07, 0.12); b(1320, 0.2, 'triangle', 0.07, 0.24); }
    else if (type === 'stuck' || type === 'dead') b(150, 0.25, 'sawtooth', 0.05);
    else if (type === 'no') b(120, 0.08, 'square', 0.05);
  };
})(typeof window !== 'undefined' ? window : globalThis);

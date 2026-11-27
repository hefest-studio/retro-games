/* СТАРАТЕЛЬ · звук: плеск воды, стук шурфа, скрип шлюза, звон подъёмника. Всё синтезируется на WebAudio движка (g.audio.beep) —
   без файлов; при выключенном звуке движок молчит. STARATEL.sfx(g, type, d) */
(function (global) {
  'use strict';
  var SW = global.STARATEL = global.STARATEL || {};
  SW.sfx = function (g, type, d) {
    var b = function (f, t, w, v, delay) { if (delay) setTimeout(function () { g.audio.beep(f, t, w, v); }, delay * 1000); else g.audio.beep(f, t, w, v); };
    if (type === 'dig') { b(110, 0.09, 'square', 0.07); b(70, 0.14, 'sawtooth', 0.06, 0.05); }
    else if (type === 'gateOpen') { b(260, 0.07, 'square', 0.05); b(420, 0.1, 'triangle', 0.05, 0.06); }
    else if (type === 'gateShut') { b(380, 0.07, 'square', 0.05); b(200, 0.12, 'triangle', 0.05, 0.06); }
    else if (type === 'cart') { b(520, 0.05, 'sine', 0.04); b(640, 0.05, 'sine', 0.04, 0.08); b(780, 0.06, 'sine', 0.04, 0.16); }
    else if (type === 'undo') b(300, 0.06, 'triangle', 0.05);
    else if (type === 'clear') { b(880, 0.12, 'triangle', 0.07); b(1100, 0.12, 'triangle', 0.07, 0.12); b(1320, 0.2, 'triangle', 0.07, 0.24); }
    else if (type === 'stuck') b(150, 0.25, 'sawtooth', 0.05);
    else if (type === 'no') b(120, 0.08, 'square', 0.05);
  };
})(typeof window !== 'undefined' ? window : globalThis);

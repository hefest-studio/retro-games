/* ДРУЖИНА · тема modern (основная): палитра интерфейса и мира для общего рендера (js/render.js).
   Мягкие градиенты неба, тени, сглаженные фигуры. DRUZHINA.modern */
(function (global) {
  'use strict';
  var D = global.DRUZHINA = global.DRUZHINA || {};
  D.modern = {
    name: 'modern', pixel: false,
    ink: '#f3eee4', muted: '#9ea3ad', accent: '#f0a03c', good: '#5fd38a', bad: '#ff5f5f', warn: '#ffc845', boss: '#ff6a3d', magic: '#6cc8ff',
    panel: 'rgba(18,20,26,.92)', line: '#3a3f4a', hudBg: 'rgba(14,15,20,.94)', barBg: '#2a2e38', shadow: 'rgba(0,0,0,.32)', outline: 'rgba(14,12,12,.85)',
    hero: { zhdan: '#ff9a4a', secha: '#6fd6e8', olha: '#9be36b' },
    font: 'Inter, system-ui, sans-serif'
  };
})(typeof window !== 'undefined' ? window : globalThis);

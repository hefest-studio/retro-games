/* ДРУЖИНА · тема retro: 16-цветная палитра «как на 16-битной приставке», мир рисуется в буфер 320×180
   и растягивается ×3 без сглаживания (крупный пиксель), цвета приводятся к палитре. DRUZHINA.classic */
(function (global) {
  'use strict';
  var D = global.DRUZHINA = global.DRUZHINA || {};
  D.classic = {
    name: 'retro', pixel: true, scale: 3,
    // своя 23-цветная палитра студии: тёмные, земля, кожа, металл, огонь, листва, вода, небо
    pal: ['#000000', '#1a1c2c', '#3b2a3a', '#5d275d', '#8a2a2a', '#c8402a', '#ef7d2a', '#ffcd75', '#f4f4e8', '#a7f070',
      '#38b764', '#257179', '#29366f', '#3b5dc9', '#41a6f6', '#73eff7', '#94b0c2', '#566c86', '#333c57', '#b86f50', '#eec39a', '#d9a066', '#6a4a3a'],
    ink: '#f4f4e8', muted: '#94b0c2', accent: '#ffcd75', good: '#a7f070', bad: '#ef7d2a', warn: '#ffcd75', boss: '#c8402a', magic: '#41a6f6',
    panel: '#1a1c2c', line: '#566c86', hudBg: '#000000', barBg: '#333c57', shadow: '#1a1c2c', outline: '#000000',
    hero: { zhdan: '#ef7d2a', secha: '#73eff7', olha: '#a7f070' },
    font: '"Courier New", ui-monospace, monospace'
  };
})(typeof window !== 'undefined' ? window : globalThis);

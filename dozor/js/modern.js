/* ДОЗОР · тема modern (основная): палитра мира и интерфейса для общего рендера (js/render.js).
   Мягкие тени под машинами и зданиями, градиентная вода, сглаженные фигуры. DOZOR.modern */
(function (global) {
  'use strict';
  var D = global.DOZOR = global.DOZOR || {};
  D.modern = {
    name: 'modern', pixel: false, scale: 1,
    ground: { sand: '#c8b07a', wharf: '#93ad6c', rail: '#a99c7a', slag: '#8a7f70', quarter: '#9c958a', hold: '#8a7c6c', test: '#a0a090' },
    road: '#b9a984', rubble: '#6e6356', wall: '#8d9098', wallTop: '#b4b8c0', wallDark: '#5c5f67', rock: '#6f675d', rockTop: '#8f877b',
    tree: '#3f7d3c', treeTop: '#5fa04f', treeDark: '#2a5528', water: '#2f6ea6', waterLight: '#64a6dc', waterDeep: '#22558a',
    bridge: '#8a6a44', plank: '#ab875c', sleeper: '#5c4a38', railMetal: '#a2a8b0', sandbag: '#b89b62', sandbagDark: '#8a7044',
    roof: '#a4564a', roofTop: '#c4705e', bldWall: '#cdbda4', barracks: '#7d6c4c', barracksRoof: '#5c4b34', barracksDoor: '#3a2e20', flag: '#ffcf4a',
    pad: '#4c525c', padRing: '#e8ecf0', padMark: '#ffcf4a', core: '#4c3c3c', coreTop: '#6a5450', coreGlow: '#ff7a2a', coreDark: '#2a2020',
    rust: '#b55e2c', rustDark: '#7a3a1c', metal: '#6c6662', metalLight: '#9a948e', metalDark: '#3a3430', eye: '#ff4a2a', warn: '#fff07a',
    hero: ['#d9c25e', '#5cb6de'], heroDark: ['#8a7a2e', '#2e6e8e'], heroLight: ['#f2e39a', '#a6dcf2'], tire: '#24262b', gun: '#2e3036',
    pow: '#f2d2a6', powShirt: '#e9edf2', powCap: '#ffcf4a', bullet: '#fff4a6', ebullet: '#ff5a3a', eglow: 'rgba(255,90,58,.35)', shell: '#ffb04a',
    grenade: '#3c4a2c', rocket: '#e8e8e8', flame: '#ffb04a', boom: ['#fff3c0', '#ffb04a', '#e0502a', 'rgba(60,40,30,.6)'], mark: '#ff4a2a',
    rescue: '#e9edf2', rescueStripe: '#ea6a12', shadow: 'rgba(0,0,0,.28)',
    ink: '#f3eee4', muted: '#a3a9b3', accent: '#a8c256', good: '#5fd38a', bad: '#ff5f5f', panel: 'rgba(16,18,22,.92)', line: '#3a3f4a',
    hudBg: 'rgba(14,16,20,.94)', barBg: '#2a2e38', boss: '#ff6a3d', font: 'Inter, system-ui, sans-serif'
  };
})(typeof window !== 'undefined' ? window : globalThis);

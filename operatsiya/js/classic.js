/* ОПЕРАЦИЯ · тема retro: ограниченная 8-битная палитра без градиентов и теней; поле рисуется в буфер половинного
   размера (клетка 16 px) и растягивается ×2 без сглаживания — крупный пиксель. OPERATSIYA.classic */
(function (global) {
  'use strict';
  var O = global.OPERATSIYA = global.OPERATSIYA || {};
  O.classic = {
    name: 'retro', pixel: true, font: '"Courier New", ui-monospace, monospace',
    void: '#000000', floor: '#1c2430', floor2: '#202a38', floorDot: '#2c3848', wall: '#68707c', wallTop: '#a4acb8', wallEdge: '#3c4450',
    brick: '#b04c2c', brickLine: '#6c2410', crate: '#c88c34', crateDark: '#704c14', door: '#3c84c8', doorDark: '#1c4c80', doorOpen: '#203450',
    rubble: '#4c4038', rubble2: '#706050', pit: '#000000', balc: '#30385c', balc2: '#384068', balcEdge: '#a8c0f8', ladder: '#f0b040',
    exit: '#30d050', zone: '#f8d030', core: '#40c8f8', coreGlow: '#40c8f8', fog: 'rgba(0,0,0,.6)',
    t0: '#f0a838', t0Dark: '#985808', t0Light: '#fff0a0', helmet: '#30c8d8', helmetDark: '#087888', visor: '#d8ffff', tool: '#e0e0e0',
    t1: '#d04828', t1Dark: '#701808', t1Light: '#f89060', eye: '#f8f040', bossC: '#a830a0', bossDark: '#501050', masterC: '#f8f8f8', masterBand: '#30d050',
    beam0: '#80f8f8', beam1: '#f88030', boom: ['#ffffc0', '#f8a830', '#e04818'], spark: '#f8e070',
    reach: 'rgba(64,200,248,.22)', reach2: 'rgba(248,208,48,.18)', path: '#40c8f8', pathBad: '#f85050', cursor: '#ffffff', sel: '#40c8f8', blast: 'rgba(248,128,48,.3)',
    ink: '#ffffff', muted: '#a8a8a8', accent: '#40c8f8', good: '#58f858', bad: '#f85858', warn: '#f8f858', heatC: '#f88030',
    panel: '#000000', panel2: '#0c1018', line: '#3c84c8', hud: '#000000', btn: '#0c1018', btnOn: '#183058', shadow: 'rgba(0,0,0,0)'
  };
})(typeof window !== 'undefined' ? window : globalThis);

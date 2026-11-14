/* ПАРОВИКИ · тема modern (основная): палитра для общего рендера (js/render.js).
   Мягкие тени, свечение пара и котлов; у каждого мира — свой тон камня и пола. PAROVIKI.modern */
(function (global) {
  'use strict';
  var PV = global.PAROVIKI = global.PAROVIKI || {};
  PV.modern = {
    name: 'modern', pixel: false,
    worlds: [null,
      { floor: '#2a2622', floor2: '#2e2925', seam: '#221e1b', wall: '#4b4038', wallTop: '#64564a', wallDark: '#2a231e', pit: '#0e0c0b', pitEdge: '#ff7a2a', deco: '#3a312a' },
      { floor: '#1f2c34', floor2: '#23323b', seam: '#18232a', wall: '#3a4c58', wallTop: '#557080', wallDark: '#1e2a32', pit: '#0f3a52', pitEdge: '#5ec8ff', deco: '#2c3c46' },
      { floor: '#2b2a20', floor2: '#302e23', seam: '#22211a', wall: '#5c4b2c', wallTop: '#8b7444', wallDark: '#33291a', pit: '#15130c', pitEdge: '#e0b04c', deco: '#403723' },
      { floor: '#2c1f1e', floor2: '#322322', seam: '#231817', wall: '#5a2f28', wallTop: '#7d4436', wallDark: '#311915', pit: '#3a1206', pitEdge: '#ff5a1a', deco: '#43261f' }
    ],
    crack: '#120e0c', crate: '#7a5a34', crateDark: '#4a3520', crateBand: '#a8834a',
    door: '#8a6a2a', doorDark: '#4a3816', doorLock: '#ffd34d', bar: '#d84a2a', bar2: '#2a2a2e',
    lever: '#9aa0a8', leverOn: '#5fd38a', leverOff: '#ff6a4a',
    valve: '#d84a3a', valveOn: '#5fd38a', valveRim: '#2a2a30', valveRing: '#ffd34d', steam: 'rgba(230,236,240,.55)',
    exit: '#3a3f46', exitRim: '#6a717a', exitOpen: '#5ef0c8', exitGlow: 'rgba(94,240,200,.25)',
    coin: '#ffcf4a', coinDark: '#a8781a', food: '#d9904a', foodTop: '#f3c27a', key: '#ffd34d', chest: '#8a5a2a', chestBand: '#ffcf4a', charge: '#7ee8ff',
    hero: ['#4fd1b0', '#ff7a4a', '#b48cff', '#ffd34d'], heroDark: ['#22786a', '#9a3a1e', '#5d3c9a', '#9a7a1e'],
    helmet: '#c9a35a', helmetDark: '#7a5e2a', glass: '#bff4ff', boiler: '#6a6f78', boilerDark: '#3a3d44', skin: '#e8b48a',
    tin: '#9aa0a8', tinDark: '#5a5f68', bug: '#c98a3a', bugDark: '#6a4418', whistle: '#7a8a70', whistleDark: '#3e4838', heavy: '#6a5a50', heavyDark: '#352c26', nest: '#4a3a32', nestMouth: '#ff8a2a', eye: '#ff4a3a',
    shot: { rivet: '#ffe6a0', steam: '#e8f2ff', saw: '#d8dde4', bolt: '#9ae8ff' }, eshot: '#ff6a3a', eglow: 'rgba(255,106,58,.28)',
    boom: ['#fff3c0', '#ffb04a', '#e0502a'], shield: 'rgba(126,232,255,.5)',
    boss: '#5a5650', bossDark: '#2e2b28', bossLight: '#8a847a', bossCore: '#ff7a2a', bossArmor: '#c9a35a', mark: 'rgba(255,74,42,.25)', markEdge: '#ff4a2a',
    shadow: 'rgba(0,0,0,.35)', fog: 'rgba(8,8,10,.0)',
    ink: '#f2ece0', muted: '#a3a9b3', accent: '#e0b04c', good: '#5fd38a', bad: '#ff5f5f', warn: '#ffd35e', panel: 'rgba(16,15,14,.94)', line: '#3d3a36',
    hudBg: '#141312', barBg: '#2a2826', font: 'Inter, system-ui, sans-serif'
  };
})(typeof window !== 'undefined' ? window : globalThis);

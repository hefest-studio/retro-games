/* ПАРОВИКИ · тема retro: 16 цветов, плоские заливки, пиксели ×2 (рендер в буфер половинного размера).
   Логика та же — меняется только отрисовка. PAROVIKI.classic */
(function (global) {
  'use strict';
  var PV = global.PAROVIKI = global.PAROVIKI || {};
  PV.classic = {
    name: 'retro', pixel: true,
    worlds: [null,
      { floor: '#383028', floor2: '#383028', seam: '#201810', wall: '#786048', wallTop: '#a88860', wallDark: '#201810', pit: '#000000', pitEdge: '#f87820', deco: '#504030' },
      { floor: '#203848', floor2: '#203848', seam: '#102030', wall: '#406880', wallTop: '#70a0b8', wallDark: '#102030', pit: '#0040a0', pitEdge: '#58c8f8', deco: '#305060' },
      { floor: '#403820', floor2: '#403820', seam: '#202010', wall: '#806020', wallTop: '#c8a040', wallDark: '#302010', pit: '#000000', pitEdge: '#f8c838', deco: '#585028' },
      { floor: '#402020', floor2: '#402020', seam: '#200808', wall: '#802818', wallTop: '#b84830', wallDark: '#300808', pit: '#600800', pitEdge: '#f85800', deco: '#582820' }
    ],
    crack: '#000000', crate: '#a86820', crateDark: '#583010', crateBand: '#f8b848',
    door: '#a87810', doorDark: '#503800', doorLock: '#f8f858', bar: '#f83800', bar2: '#000000',
    lever: '#a8a8a8', leverOn: '#58f858', leverOff: '#f83800',
    valve: '#f83800', valveOn: '#58f858', valveRim: '#000000', valveRing: '#f8f858', steam: '#ffffff',
    exit: '#505050', exitRim: '#a8a8a8', exitOpen: '#58f8d8', exitGlow: '#008878',
    coin: '#f8d800', coinDark: '#a87800', food: '#f89838', foodTop: '#f8d898', key: '#f8f858', chest: '#a85800', chestBand: '#f8d800', charge: '#58d8f8',
    hero: ['#58f8b8', '#f87848', '#b878f8', '#f8e048'], heroDark: ['#008868', '#a82800', '#5828a8', '#a88800'],
    helmet: '#f8b848', helmetDark: '#a86800', glass: '#a8f8f8', boiler: '#a8a8a8', boilerDark: '#585858', skin: '#f8b888',
    tin: '#bcbcbc', tinDark: '#686868', bug: '#e89838', bugDark: '#884800', whistle: '#88a878', whistleDark: '#384830', heavy: '#887060', heavyDark: '#403028', nest: '#584038', nestMouth: '#f87800', eye: '#f80000',
    shot: { rivet: '#f8f8a8', steam: '#ffffff', saw: '#e8e8e8', bolt: '#58f8f8' }, eshot: '#f85838', eglow: null,
    boom: ['#ffffff', '#f8b800', '#f83800'], shield: '#58d8f8',
    boss: '#787068', bossDark: '#383028', bossLight: '#b8b0a0', bossCore: '#f87800', bossArmor: '#f8b848', mark: null, markEdge: '#f83800',
    shadow: null,
    ink: '#ffffff', muted: '#a8a8a8', accent: '#f8c048', good: '#58f858', bad: '#f85858', warn: '#f8f858', panel: '#000000', line: '#a87810',
    hudBg: '#000000', barBg: '#383838', font: '"Courier New", ui-monospace, monospace'
  };
})(typeof window !== 'undefined' ? window : globalThis);

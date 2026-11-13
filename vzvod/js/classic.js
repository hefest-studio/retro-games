/* ВЗВОД · тема retro: ограниченная «8-битная» палитра без градиентов и теней; мир рисуется в буфер половинного
   размера и растягивается ×2 без сглаживания — крупный пиксель (ui.js). VZVOD.classic */
(function (global) {
  'use strict';
  var V = global.VZVOD = global.VZVOD || {};
  V.classic = {
    name: 'retro', pixel: true,
    biome: {
      factory: { ground: '#383838', ground2: '#404040', seam: '#303030', decor: '#505050', oil: '#202020', wall: '#685848', wallTop: '#988870', wallFront: '#383028',
        liq: '#002838', liq2: '#005878', crate: '#a87838', crateDark: '#584018', pipe: '#d88838', pipeDark: '#784018', rail: '#888888', sleeper: '#503820', rubble: '#484040' },
      snow: { ground: '#d8e0f0', ground2: '#c8d0e8', seam: '#b8c0d8', decor: '#f8f8f8', oil: '#a8b8d0', wall: '#506888', wallTop: '#7898b8', wallFront: '#304058',
        liq: '#0058a8', liq2: '#3888d8', crate: '#a87838', crateDark: '#584018', pipe: '#a88858', pipeDark: '#584028', rail: '#8898a8', sleeper: '#786040', rubble: '#98a0b0' },
      swamp: { ground: '#504828', ground2: '#585030', seam: '#403820', decor: '#78a038', oil: '#383018', wall: '#585048', wallTop: '#787068', wallFront: '#302820',
        liq: '#185838', liq2: '#38a070', crate: '#987030', crateDark: '#503818', pipe: '#d89038', pipeDark: '#704010', rail: '#787868', sleeper: '#403020', rubble: '#686050' }
    },
    unit: ['#f8b838', '#38d8c8'], unitDark: ['#a06808', '#087870'], unitLight: ['#f8f0a0', '#b8f8f0'], visor: '#58d8f8', key: '#d8d8d8', tool: '#f8f8f8', toolTip: '#98f8f8',
    rust: '#b85818', rustDark: '#682808', rustLight: '#e89048', eye: '#f8a800', rush: '#c83820', rushDark: '#701808', turret: '#706058', turretDark: '#382820',
    heavy: '#886048', heavyDark: '#483020', smoke: '#787068',
    hive: '#883818', hiveDark: '#481808', hiveCell: '#c86020', hiveGlow: '#f87800', hiveCore: '#f8b800',
    vip: '#58f878', vipDark: '#088838', cart: '#a0a8b0', cartDark: '#505860', skimmer: '#78b0e0', skimmerDark: '#305880',
    beam: '#98f8f8', beamCore: '#ffffff', bolt: '#f85818', boltGlow: '#f85818', shell: '#f8d838',
    boom: ['#f8f8c0', '#f8a830', '#e04818', '#503828'], spark: '#f8e078',
    pickGear: '#f8d838', pickRocket: '#f88848', crateBox: '#785028',
    zone: '#58a8f8', exit: '#58f878', mark: '#ffffff', cross: '#ffffff', crossFire: '#f85818',
    shadow: '#00000050',
    ink: '#ffffff', muted: '#a8a8a8', accent: '#98e058', good: '#58f858', bad: '#f85858', warn: '#f8f878', panel: '#000000', line: '#58a838',
    hudBg: '#000000', barBg: '#383838', mm: '#000000', font: '"Courier New", ui-monospace, monospace'
  };
})(typeof window !== 'undefined' ? window : globalThis);

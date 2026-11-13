/* ГОРНИЛО · тема retro: «8-битная» палитра, без градиентов и мягких теней; мир рисуется в буфер
   половинного размера (320×240) и растягивается ×2 без сглаживания — крупный пиксель (ui.js). GORNILO.classic */
(function (global) {
  'use strict';
  var G = global.GORNILO = global.GORNILO || {};
  G.classic = {
    name: 'retro', pixel: true,
    floor: '#281810', floor2: '#301c10', seam: '#180c08', glow: '#f87818', glowSoft: '#5a2408',
    wall: '#584840', wallTop: '#887868', wallDark: '#201410', rivet: '#a89888',
    gate: '#000000', gateBar: '#786860', gateHot: '#f89838', gateOpen: '#38f8b8', gateLock: '#b82810',
    anvil: '#505868', anvilTop: '#8890a0', anvilDark: '#202838', hatch: '#181010', hatchRing: '#685850',
    hero: ['#f8c838', '#38e8d8'], heroDark: ['#a07010', '#108878'], heroLight: ['#f8f0a0', '#b8f8f0'], apron: '#783818', visor: '#000000',
    blank: '#a8a8b0', blankDark: '#585860', blankEye: '#f8b800',
    runner: '#e85820', runnerDark: '#801808', fuse: '#f8f878',
    turret: '#787888', turretDark: '#383848', turretBarrel: '#101018',
    shield: '#8890a0', shieldDark: '#404858', shieldPlate: '#f8f8f8',
    roller: '#706050', rollerDark: '#302820', rollerBand: '#d8a840',
    bullet: '#f8f8a0', bulletCore: '#ffffff', ebullet: '#f83818', eglow: '#f83818', flame: ['#f8f8a0', '#f8a030', '#e83800'],
    disc: '#78f8f8', grenade: '#304030', boom: ['#f8f8c0', '#f8a030', '#e04018', '#503828'],
    ring: '#78d8f8', hammer: '#d8d8e0', hammerHead: '#909098',
    pick: { fan: '#f8d838', flame: '#f87818', grenade: '#98d838', disc: '#78f8f8', ring: '#8898f8', hammers: '#e0e0e8', gold: '#f8d838', life: '#f85878' },
    boss: '#585060', bossDark: '#282030', bossLight: '#908898', core: '#f87818', coreArmor: '#686070', mark: '#581808', markEdge: '#f83818',
    shadow: '#00000040',
    ink: '#ffffff', muted: '#a8a8a8', accent: '#f89838', good: '#58f858', bad: '#f85858', warn: '#f8f878', panel: '#000000', line: '#a85818',
    hudBg: '#000000', barBg: '#383838', font: '"Courier New", ui-monospace, monospace'
  };
})(typeof window !== 'undefined' ? window : globalThis);

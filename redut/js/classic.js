/* РЕДУТ · тема retro: «8-битная» палитра из 16 цветов, без градиентов и мягких теней; мир рисуется в буфер половинного
   размера (240×298) и растягивается ×2 без сглаживания — крупный пиксель (ui.js). REDUT.classic */
(function (global) {
  'use strict';
  var R = global.REDUT = global.REDUT || {};
  R.classic = {
    name: 'retro', pixel: true, scale: 2,
    bg0: '#000018', bg1: '#00002a', grid: '#10104a', stone: '#282878', tuft: '#106858',
    core: '#6868d8', coreTop: '#a8a8f8', coreDark: '#202070', lamp: '#f8f878', halo: '#000048', haloEdge: '#181860',
    beam: '#f8f858', beamHot: '#ffffff', beamGlow: '#585810', trail: '#a0a020',
    pylon: '#58d8f8', pylonDark: '#186888', pylonDim: '#585868',
    hero: '#20b8a0', heroDark: '#106858', heroHood: '#e8f8f0', lantern: '#f8f8a8',
    mist: '#401870', mistEdge: '#a050f0', eye: '#f85898', armor: '#503080', shell: '#a070f0', leap: '#106858', leapEye: '#58f8f8',
    snuff: '#000000', snuffRing: '#c050f8', eater: '#300848', eaterEdge: '#a050f0', maw: '#f87820',
    flare: '#ffffff', flareEdge: '#f8f8a8', mark: '#f85898',
    good: '#58f858', bad: '#f85858', warn: '#f8d858', ink: '#ffffff', muted: '#a8a8b8', accent: '#f8d858',
    panel: '#000000', line: '#5858f8', hudBg: '#000000', barBg: '#383858', boss: '#f87820', shadow: '#00000040',
    font: '"Courier New", ui-monospace, monospace'
  };
})(typeof window !== 'undefined' ? window : globalThis);

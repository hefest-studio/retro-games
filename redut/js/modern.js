/* РЕДУТ · тема modern (основная): ночная палитра с мягким свечением — маяк, луч, опоры и мгла рисуются градиентами (js/render.js). REDUT.modern */
(function (global) {
  'use strict';
  var R = global.REDUT = global.REDUT || {};
  R.modern = {
    name: 'modern', pixel: false, scale: 1,
    bg0: '#060a13', bg1: '#13203a', grid: '#182741', stone: '#22314d', tuft: '#1f3a3a',
    core: '#2b3a55', coreTop: '#52709e', coreDark: '#141d30', lamp: '#ffe9a8', halo: 'rgba(255,214,120,.20)', haloEdge: 'rgba(255,214,120,.18)',
    beam: '#ffd86b', beamHot: '#fffbe8', beamGlow: 'rgba(255,200,90,.22)', trail: 'rgba(255,216,107,.5)',
    pylon: '#9fd3ff', pylonDark: '#315a80', pylonDim: '#4a5a70',
    hero: '#2fa39c', heroDark: '#1b6663', heroHood: '#e2f6f1', lantern: '#fff0b0',
    mist: '#1d1233', mistEdge: '#5b3d9a', eye: '#ff5fa2', armor: '#2a2140', shell: '#7a5fc4', leap: '#16303f', leapEye: '#6bf2ff',
    snuff: '#0a0614', snuffRing: '#a05cff', eater: '#120a1c', eaterEdge: '#6a2f9c', maw: '#ff7a3d',
    flare: '#fff4c2', flareEdge: 'rgba(255,244,194,.55)', mark: '#ff6b9a',
    good: '#6fe3a0', bad: '#ff6b7a', warn: '#ffd36b', ink: '#eef2fa', muted: '#97a3ba', accent: '#ffd86b',
    panel: 'rgba(10,14,24,.93)', line: '#2a3a58', hudBg: 'rgba(7,10,19,.96)', barBg: '#1b2538', boss: '#ff7a3d', shadow: 'rgba(0,0,0,.35)',
    font: 'Inter, system-ui, sans-serif'
  };
})(typeof window !== 'undefined' ? window : globalThis);

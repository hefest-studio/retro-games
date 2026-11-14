/* ОПЕРАЦИЯ · тема modern (основная): мягкие тени и свечение, стальной цех в холодных тонах.
   Механики — медно-янтарные комбинезоны и бирюзовые каски; автоматоны Совета — ржавчина с янтарным глазом. OPERATSIYA.modern */
(function (global) {
  'use strict';
  var O = global.OPERATSIYA = global.OPERATSIYA || {};
  O.modern = {
    name: 'modern', pixel: false, font: 'Inter, system-ui, sans-serif',
    void: '#07090c', floor: '#272b33', floor2: '#2b3039', floorDot: 'rgba(255,255,255,.05)', wall: '#3c424e', wallTop: '#596171', wallEdge: '#2a2f38',
    brick: '#8a4d38', brickLine: '#5e3324', crate: '#9a7448', crateDark: '#634a2d', door: '#4f6b86', doorDark: '#344a60', doorOpen: '#2f3b4a',
    rubble: '#4a4440', rubble2: '#5d5650', pit: '#050608', balc: '#39414f', balc2: '#3e4756', balcEdge: '#9fb3cf', ladder: '#c49a58',
    exit: '#3fae6a', zone: '#e0b04c', core: '#64b5f6', coreGlow: 'rgba(100,181,246,.35)', fog: 'rgba(6,8,12,.62)',
    t0: '#d9964a', t0Dark: '#8a5a22', t0Light: '#ffd49a', helmet: '#3fb8c8', helmetDark: '#1f7480', visor: '#bff4ff', tool: '#c9ced8',
    t1: '#a9553c', t1Dark: '#5e2c1e', t1Light: '#d98762', eye: '#ffb03a', bossC: '#7e3b5c', bossDark: '#401c30', masterC: '#e6e9f0', masterBand: '#5fd38a',
    beam0: '#9ff6ff', beam1: '#ff8a4a', boom: ['#fff3c0', '#ffb04a', '#e0502a'], spark: '#ffe08a',
    reach: 'rgba(100,181,246,.11)', reach2: 'rgba(255,200,80,.09)', path: '#64b5f6', pathBad: '#ff5f5f', cursor: '#ffffff', sel: '#64b5f6', blast: 'rgba(255,120,60,.25)',
    ink: '#eef2f8', muted: '#9aa4b5', accent: '#64b5f6', good: '#5fd38a', bad: '#ff5f5f', warn: '#ffd35e', heatC: '#ff7a3a',
    panel: '#11151c', panel2: '#181d27', line: '#2b3342', hud: '#0d1016', btn: '#1a202b', btnOn: '#24344a', shadow: 'rgba(0,0,0,.35)'
  };
})(typeof window !== 'undefined' ? window : globalThis);

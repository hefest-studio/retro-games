/* ОТСЕК · тема retro: 16-битный дух с ограниченной палитрой, без градиентов и мягких теней; мир рисуется в буфер
   половинного размера (320×240) и растягивается ×2 без сглаживания, свет фонаря — ступенчатыми кольцами. OTSEK.classic */
(function (global) {
  'use strict';
  var G = global.OTSEK = global.OTSEK || {};
  G.classic = {
    name: 'retro', pixel: true,
    space: '#000000', floor: '#303848', floor2: '#283040', seam: '#181c28', rust: '#784020', grate: '#202430', rivet: '#586070',
    wall: '#101018', wallFace: '#485068', wallEdge: '#7880a0', wallTop: '#181c28', pipe: '#885028',
    part: '#905828', partDark: '#482810', partEdge: '#c88848',
    doorFrame: '#7880a0', door: '#586078', doorDark: '#101018', doorPath: '#e0e040', doorSide: '#58a8f8',
    good: '#58f858', goodDim: '#186818', bad: '#f83820', badDim: '#681810',
    airFloor: '#202028', airStripe: '#685818', airStripeOn: '#f8d838', airFrame: '#a8b0c8',
    termBody: '#485068', termScreen: '#38f8d8', termText: '#004840', termBase: '#282c38',
    consoleBody: '#482830', consoleEdge: '#a06060', consoleLamp: '#f83820', consoleLampDim: '#681810',
    card: '#e0e040', cardStripe: '#505000', cardChip: '#ffffff',
    ammoBox: '#587030', ammoTip: '#f8d060', medBox: '#f8f8f8', medCross: '#f83820', token: '#f8c038', tokenDark: '#886000',
    cache: '#885828', cacheBand: '#d8a048',
    tick: '#c86028', tickDark: '#602810', tickLeg: '#904820', carpet: '#a84818', carpetDark: '#682808',
    wire: '#d88838', wireCore: '#783818', nest: '#683820', nestLight: '#905030', nestHole: '#f89038',
    coil: '#586878', coilRing: '#88d8f8', vein: '#883820', veinDark: '#f87830',
    bossCable: '#884820', boss: '#504038', bossDark: '#281810', bossShell: '#706058', core: '#f88830', coreHot: '#f8e070',
    heart: '#702818', heartCrack: '#f88830',
    hero: ['#f89830', '#38c8b0'], heroDark: ['#985010', '#106858'], helmet: ['#f8f8f0', '#f8f8f0'], tank: '#606870', belt: '#202020', gun: '#c0c8d0', lampLens: '#ffffc0',
    shadow: '#00000040', flame: ['#f8f8a0', '#f8a030', '#e84800'], cutter: '#78d8f8', cutterCore: '#ffffff', nail: '#e0e0e0', bullet: '#f8f0a0',
    sparkGlow: '#f8682080', spark: '#f8d070', ember: '#f88830',
    dark: 'rgba(0,0,0,.9)', darkAlarm: 'rgba(36,0,0,.86)', beam: 'rgba(0,0,0,0)', lamp: '#f8a060', alarm: '#f83820',
    mapFloor: '#6878a0', mapFloorDim: '#303850',
    ink: '#ffffff', muted: '#a8a8b8', accent: '#e0e040', warn: '#f8f878', panel: '#000000', line: '#5868a0',
    hudBg: '#000000', barBg: '#303040', font: '"Courier New", ui-monospace, monospace'
  };
})(typeof window !== 'undefined' ? window : globalThis);

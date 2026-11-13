/* ОТСЕК · тема modern (основная): палитра станции-кузни «Наковальня-7» и интерфейса для общего рендера (js/render.js).
   Сине-стальной корпус, ржавые паразиты с тлеющими угольками, мягкий свет фонарей и тени. OTSEK.modern */
(function (global) {
  'use strict';
  var G = global.OTSEK = global.OTSEK || {};
  G.modern = {
    name: 'modern', pixel: false,
    space: '#07090c', floor: '#2a3136', floor2: '#283035', seam: '#1c2226', rust: '#5a3a26', grate: '#20272b', rivet: '#4a555c',
    wall: '#12161a', wallFace: '#39434a', wallEdge: '#55626a', wallTop: '#1a2025', pipe: '#6a4a32',
    part: '#6b4a32', partDark: '#3a271a', partEdge: '#9a6a44',
    doorFrame: '#55626a', door: '#4a5660', doorDark: '#1a1f23', doorPath: '#d6e04f', doorSide: '#6fb3ff',
    good: '#5fe08a', goodDim: '#2a6a40', bad: '#ff5a4a', badDim: '#7a2a22',
    airFloor: '#1d2427', airStripe: '#5a4a1e', airStripeOn: '#c9b23a', airFrame: '#8a9aa2',
    termBody: '#3c4850', termScreen: '#58e0d0', termText: '#0c3a36', termBase: '#262e33',
    consoleBody: '#3a2a2c', consoleEdge: '#7a5a5a', consoleLamp: '#ff4a3a', consoleLampDim: '#6a2a24',
    card: '#d6e04f', cardStripe: '#4a5010', cardChip: '#f8f4c0',
    ammoBox: '#5a6a3a', ammoTip: '#e8c060', medBox: '#e8ecef', medCross: '#e0443a', token: '#e8b84a', tokenDark: '#8a6a1a',
    cache: '#7a5a34', cacheBand: '#c89a4a',
    tick: '#b0582c', tickDark: '#5a2a14', tickLeg: '#7a4a2a', carpet: '#9a4a24', carpetDark: '#5e2c16',
    wire: '#c07a3a', wireCore: '#6a3a1a', nest: '#5a3a2a', nestLight: '#7a5038', nestHole: '#ff8a3a',
    coil: '#5a6a7a', coilRing: '#8fd0ff', vein: '#7a3a2a', veinDark: '#ff7a3a',
    bossCable: '#7a4a2a', boss: '#4a3a34', bossDark: '#2a1e1a', bossShell: '#6a5a54', core: '#ff8a3a', coreHot: '#ffd070',
    heart: '#6a2e1e', heartCrack: '#ff8a3a',
    hero: ['#f0a03c', '#4fc1b0'], heroDark: ['#8a5214', '#1f6a60'], helmet: ['#f4f0e6', '#f4f0e6'], tank: '#5a646a', belt: '#2a2a2a', gun: '#b8c2c8', lampLens: '#fff6c8',
    shadow: 'rgba(0,0,0,.35)', flame: ['#fff2b0', '#ffb040', '#ff5a20'], cutter: 'rgba(120,220,255,.7)', cutterCore: '#e8fbff', nail: '#d8dde0', bullet: '#ffe8a0',
    sparkGlow: 'rgba(255,120,40,.45)', spark: '#ffd27a', ember: '#ff8a3a',
    dark: 'rgba(3,5,8,.88)', darkAlarm: 'rgba(24,3,3,.84)', beam: 'rgba(255,230,170,.06)', lamp: '#ffb070', alarm: '#ff3a2a',
    mapFloor: '#5a6a72', mapFloorDim: '#2e383e',
    ink: '#eef1f2', muted: '#9aa6ad', accent: '#d6e04f', warn: '#ffd35e', panel: 'rgba(12,15,18,.95)', line: '#34404a',
    hudBg: '#0b0e11', barBg: '#262e33', font: 'Inter, system-ui, sans-serif'
  };
})(typeof window !== 'undefined' ? window : globalThis);

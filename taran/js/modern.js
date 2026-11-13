/* ТАРАН · тема modern (основная): палитры дворов (цех, крыши, рельсы, склад), машин и интерфейса для js/render.js.
   Мягкие тени, блики на корпусах, пар из труб. TARAN.modern */
(function (global) {
  'use strict';
  var T = global.TARAN = global.TARAN || {};
  T.modern = {
    name: 'modern', pixel: false,
    set: {
      shop: { ground: '#2a2926', ground2: '#302f2b', tile: 64, road: '#464a53', road2: '#50545e', edge: '#1b1c20', curbA: '#e2b13c', curbB: '#2a2b30', isl: '#4c525e', islTop: '#626a78', prop: '#474c57', propTop: '#5c6371', propAcc: '#d07a2e' },
      roof: { ground: '#5b322a', ground2: '#4e2a23', tile: 24, road: '#2d2c30', road2: '#353439', edge: '#1d1b1d', curbA: '#b9644a', curbB: '#d8cfc0', isl: '#6e3a30', islTop: '#874a3c', prop: '#6b6460', propTop: '#8a827c', propAcc: '#ececec' },
      rail: { ground: '#4a4439', ground2: '#3f3a31', tile: 40, road: '#6a5e4d', road2: '#726652', edge: '#2e2820', curbA: '#3b2d22', curbB: '#8c7b63', isl: '#5a5246', islTop: '#746a5a', prop: '#5b4a3a', propTop: '#7a6450', propAcc: '#a8a8b0' },
      store: { ground: '#5f4a33', ground2: '#56432e', tile: 32, road: '#7b8088', road2: '#848991', edge: '#3a3d42', curbA: '#3f7fc0', curbB: '#e8e8e8', isl: '#8a6a44', islTop: '#a8834f', prop: '#8a6a44', propTop: '#a8834f', propAcc: '#cfb27a' }
    },
    start: ['#f2f2f2', '#1a1a1a'], ramp: '#c9a24a', rampDark: '#7a6230', chevron: '#2a2622', slag: '#ff6a1f', slagDark: '#8a2410', slagGlow: 'rgba(255,110,30,.35)',
    oil: '#141418', oilSheen: 'rgba(130,150,255,.35)', rail: '#9aa0aa', sleeper: '#4a3a2c', cart: '#6a5a48', cartTop: '#8a7660', ore: '#3a3a40',
    press: '#5a606c', pressTop: '#7c8494', pressWarn: 'rgba(255,70,40,.35)', pressFrame: '#2c3038', pit: 'rgba(90,220,140,.16)', pitEdge: '#5fd38a',
    mine: '#b8bcc4', mineDark: '#5c6068', mineLed: '#ff4a2a', rivet: '#ffe7a0', rocket: '#d8dce4', rocketFin: '#c8483a', flame: ['#fff2b0', '#ffb040', '#ff6020'],
    boom: ['#fff3c0', '#ffb04a', '#e0502a', 'rgba(60,40,30,.5)'], smoke: 'rgba(220,220,225,', steam: 'rgba(235,240,245,',
    carDark: 'rgba(0,0,0,.35)', carLight: 'rgba(255,255,255,.28)', boiler: '#4a4f5a', boilerBand: '#b08a3a', bumper: '#9aa2ae', wheel: '#151518', chimney: '#2a2c31',
    shadow: 'rgba(0,0,0,.35)', ink: '#f3eee4', muted: '#a3a9b3', accent: '#ef5b3f', good: '#5fd38a', bad: '#ff5f5f', warn: '#ffd35e',
    panel: 'rgba(16,16,20,.94)', line: '#3a3a44', hudBg: '#121216', barBg: '#2a2a32', font: 'Inter, system-ui, sans-serif', mapBg: 'rgba(10,10,14,.42)'
  };
})(typeof window !== 'undefined' ? window : globalThis);

/* ГРОМ · рендер «retro»: то же ядро спрайтов (GROM.makeRenderer), но квадратные пиксели без сглаживания,
   16 цветов EGA, кирпичная кладка скал, жёсткие края — дух 16-битных компьютеров начала 90-х. */
(function (global) {
  'use strict';
  var GR = global.GROM = global.GROM || {};
  GR.classic = GR.makeRenderer({
    pixel: true, font: '"Courier New", ui-monospace, monospace',
    bg2: '#000000', panel: '#000000', panelA: '#000000', line: '#5555ff', ink: '#ffffff', muted: '#aaaaaa',
    accent: '#ffff55', good: '#55ff55', bad: '#ff5555', warn: '#ffff55', wheel: '#55ffff', flash: '#ffffff',
    hudBg: '#000000', hudLine: '#5555ff', barBg: '#555555', mapBg: '#000000', mapRoom: '#5555ff',
    gem: '#ff55ff', mast: '#aaaaaa', mastOff: '#555555', mineC: '#aa5500',
    bonus: '#aa5500', bonusHi: '#ffff55', bonusLo: '#000000', gate: '#aa0000', gateHi: '#ff5555',
    foe: '#aaaaaa', foeLo: '#555555', eye: '#ff5555', ebul: '#ff5555', boss: '#aaaaaa', bossLo: '#555555', bossHi: '#aa5500',
    heroB: '#aa5500', heroS: '#aaaaaa', heroD: '#555555', visor: '#ffff55',
    wcol: { S: '#ffff55', L: '#55ffff', B: '#55ff55' },
    zones: {
      foundry: { sky0: '#000000', far: '#1a0a00', rock: '#aa5500', rock2: '#552a00', deep: '#000000', lip: '#ffff55', lip2: '#aa5500', under: '#552a00', side: '#552a00', crack: '#ffff55', plate: '#555555', plateHi: '#aaaaaa', plateLo: '#000000' },
      steam: { sky0: '#000000', far: '#001a1a', rock: '#00aaaa', rock2: '#005555', deep: '#000000', lip: '#55ffff', lip2: '#00aaaa', under: '#005555', side: '#005555', crack: '#55ffff', plate: '#555555', plateHi: '#aaaaaa', plateLo: '#000000' },
      copper: { sky0: '#000000', far: '#001a00', rock: '#00aa00', rock2: '#005500', deep: '#000000', lip: '#55ff55', lip2: '#00aa00', under: '#005500', side: '#005500', crack: '#55ff55', plate: '#aa5500', plateHi: '#ffff55', plateLo: '#000000' },
      storm: { sky0: '#000000', far: '#0a0a1a', rock: '#5555ff', rock2: '#0000aa', deep: '#000000', lip: '#ff55ff', lip2: '#5555ff', under: '#0000aa', side: '#0000aa', crack: '#ff55ff', plate: '#555555', plateHi: '#aaaaaa', plateLo: '#000000' }
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);

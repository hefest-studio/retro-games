/* ПОДКОП · строки RU/EN/TR/ES/PT (движок v2.8 берёт языки из ключей strings). Название: RU — ПОДКОП, EN/TR/ES/PT — DRIFTSTAIR
   (одно имя внутри языка, Яндекс 5.1.3). Ключи play/language/theme/… — для экранов движка, остальные — игре.
   TR/ES/PT — перевод ИИ по глоссарию tools/i18n-glossary.md; носитель не вычитывал. */
(function (global) {
  'use strict';
  var PK = global.PODKOP = global.PODKOP || {};
  PK.STR = {
    ru: {
      play: 'Играть', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл', score: 'Счёт', level: 'Уровень', best: 'Рекорд',
      win: 'ВСЕ ДЮНЫ ПРОЙДЕНЫ!', gameover: 'ЗАСЫПАЛО', pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      title: 'ПОДКОП', subtitle: 'Сыпучий песок: копай, сыпь, засыпай', back: 'Каталог', lives: 'Жизни', sand: 'Песок', retry: 'Заново (−1 жизнь)',
      lb: 'Лидеры', lbAll: 'Очки', rwBonus: 'Реклама: +4 зерна в мешок', oldBest: 'Прежний рекорд', migrated: 'Игра обновлена: теперь это «ПОДКОП» с сыпучим песком, новый рекорд — с нуля',
      clear: 'ДВЕРЬ ОТКРЫТА', bonus: 'Бонус', btime: 'за время', bsand: 'за песок', nextUp: 'пробел / тап — дальше', bury: 'ЗАСЫПАН', life: '+1 ЖИЗНЬ', dig: 'Копать', pour: 'Сыпать', go: 'К ДВЕРИ!',
      tut1: 'Держи ⛏ — копай песок перед собой, ▼ — сыпь зерно. Насыпь ступеньку у стены и взойди на уступ к двери', tut1b: 'Стик вверх / вниз + ⛏ — копать над головой / под ногами. Песок в мешок: до 12 зёрен',
      tut2: 'Шипы! Стой на краю и сыпь вперёд, пока яма не засыплется до дна', tut3: 'Песок осыпается под углом 45°: сыпь ступени у стены — каждая на клетку выше',
      tut4: 'Краб! Касание — минус жизнь. Зерно, упавшее сверху, засыпает его: встань на край и сыпь, когда краб внизу', tut5: 'Пескопад сыплет без остановки: набери мешок и засыпь ров. Стоять под струёй нельзя',
      tut6: 'Скорпион идёт за тобой. Встань на край: он упрётся в стену под обрывом — сыпь на него сверху', tut7: 'Всё вместе: пескопад даёт песок, но наверх уже не вернуться. Считай зёрна',
      tutK1: 'Z / Пробел — копать песок перед собой, X — сыпать зерно. Насыпь ступеньку у стены и взойди на уступ к двери', tutK1b: 'Стрелка вверх / вниз + Z — копать над головой / под ногами. В мешке до 12 зёрен',
      hint: 'Стрелки — ход · Z / Пробел — копать · X — сыпать · P — пауза', hintTouch: 'Стик — ход · ⛏ копать · ▼ сыпать · II — пауза',
      foot: '<b>ПОДКОП</b> · стрелки/WASD — ход, Z/Пробел — копать, X — сыпать · стрелка вверх/вниз + Z — копать вверх/вниз · P/Esc — пауза · L язык, T тема, M звук'
    },
    en: {
      play: 'Play', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off', score: 'Score', level: 'Level', best: 'Best',
      win: 'EVERY DUNE CLEARED!', gameover: 'BURIED', pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      title: 'DRIFTSTAIR', subtitle: 'Loose sand: dig it, pour it, bury them', back: 'Catalog', lives: 'Lives', sand: 'Sand', retry: 'Restart (−1 life)',
      lb: 'Leaderboard', lbAll: 'Score', rwBonus: 'Watch ad: +4 grains in the bag', oldBest: 'Previous best', migrated: 'Game updated: it is DRIFTSTAIR now, with loose sand; new best starts from zero',
      clear: 'DOOR REACHED', bonus: 'Bonus', btime: 'time', bsand: 'sand', nextUp: 'space / tap — next', bury: 'BURIED', life: '+1 LIFE', dig: 'Dig', pour: 'Pour', go: 'TO THE DOOR!',
      tut1: 'Hold ⛏ to dig sand in front of you, ▼ to pour a grain. Pour a step by the wall and climb to the door ledge', tut1b: 'Stick up / down + ⛏ digs above / below you. The bag holds 12 grains',
      tut2: 'Spikes! Stand at the edge and pour forward until the pit is filled to the bottom', tut3: 'Sand slides at 45°: pour steps by the wall, each one cell higher',
      tut4: 'A crab! Touching it costs a life. A grain falling from above buries it: stand on the edge and pour when the crab is below', tut5: 'The sand chute pours nonstop: fill your bag and fill the pit. Do not stand under the stream',
      tut6: 'The scorpion follows you. Stand on the edge: it stops at the wall below the drop — pour on it from above', tut7: 'Everything at once: the sand chute gives sand, but there is no way back up. Count your grains',
      tutK1: 'Z / Space digs sand in front of you, X pours a grain. Pour a step by the wall and climb to the door ledge', tutK1b: 'Arrow up / down + Z digs above / below you. The bag holds 12 grains',
      hint: 'Arrows: move · Z / Space: dig · X: pour · P: pause', hintTouch: 'Stick: move · ⛏ dig · ▼ pour · II: pause',
      foot: '<b>DRIFTSTAIR</b> · arrows/WASD: move, Z/Space: dig, X: pour · arrow up/down + Z: dig up/down · P/Esc: pause · L language, T theme, M sound'
    },
    tr: {
      play: 'Oyna', language: 'Dil', theme: 'Tema', sound: 'Ses', on: 'açık', off: 'kapalı', score: 'Skor', level: 'Seviye', best: 'Rekor',
      win: 'TÜM KUM TEPELERİ AŞILDI!', gameover: 'KUMA GÖMÜLDÜN', pause: 'DURAKLAT', resume: 'Devam', menu: 'Menü', tapstart: 'boşluk / dokun',
      title: 'DRIFTSTAIR', subtitle: 'Akıcı kum: kaz, dök, göm', back: 'Katalog', lives: 'Can', sand: 'Kum', retry: 'Yeniden (−1 can)',
      lb: 'Sıralama', lbAll: 'Puan', rwBonus: 'Reklam: çantaya +4 kum tanesi', oldBest: 'Önceki rekor', migrated: 'Oyun güncellendi: artık DRIFTSTAIR, akıcı kumlu; yeni rekor sıfırdan başlar',
      clear: 'KAPIYA ULAŞTIN', bonus: 'Bonus', btime: 'süre', bsand: 'kum', nextUp: 'boşluk / dokun — devam', bury: 'GÖMÜLDÜ', life: '+1 CAN', dig: 'Kaz', pour: 'Dök', go: 'KAPIYA!',
      tut1: '⛏ basılı tut: önündeki kumu kaz, ▼ ile bir tane dök. Duvarın dibine basamak dök ve kapının çıkıntısına çık', tut1b: 'Çubuk yukarı / aşağı + ⛏ başının üstünü / ayağının altını kazar. Çantaya 12 tane sığar',
      tut2: 'Dikenler! Kenarda dur ve çukur dibine dek dolana kadar öne dök', tut3: 'Kum 45° açıyla kayar: duvarın dibine basamaklar dök, her biri bir kare yüksek',
      tut4: 'Yengeç! Dokunmak can götürür. Yukarıdan düşen tane onu gömer: kenarda dur ve yengeç altındayken dök', tut5: 'Kum şelalesi durmadan akar: çantanı doldur, hendeği doldur. Akışın altında durma',
      tut6: 'Akrep seni kovalar. Kenarda dur: uçurumun altındaki duvara toslar — üstünden üzerine dök', tut7: 'Hepsi bir arada: şelale kum verir ama yukarı dönüş yok. Taneleri say',
      tutK1: 'Z / Boşluk önündeki kumu kazar, X bir tane döker. Duvarın dibine basamak dök ve kapının çıkıntısına çık', tutK1b: 'Yukarı / aşağı ok + Z başının üstünü / ayağının altını kazar. Çantaya 12 tane sığar',
      hint: 'Oklar: hareket · Z / Boşluk: kaz · X: dök · P: duraklat', hintTouch: 'Çubuk: hareket · ⛏ kaz · ▼ dök · II: duraklat',
      foot: '<b>DRIFTSTAIR</b> · oklar/WASD: hareket, Z/Boşluk: kaz, X: dök · yukarı/aşağı ok + Z: yukarı/aşağı kaz · P/Esc: duraklat · L dil, T tema, M ses'
    },
    es: {
      play: 'Jugar', language: 'Idioma', theme: 'Tema', sound: 'Sonido', on: 'sí', off: 'no', score: 'Puntos', level: 'Nivel', best: 'Récord',
      win: '¡TODAS LAS DUNAS SUPERADAS!', gameover: 'ENTERRADO', pause: 'PAUSA', resume: 'Continuar', menu: 'Menú', tapstart: 'espacio / toca',
      title: 'DRIFTSTAIR', subtitle: 'Arena suelta: cava, vierte, entierra', back: 'Catálogo', lives: 'Vidas', sand: 'Arena', retry: 'Reiniciar (−1 vida)',
      lb: 'Clasificación', lbAll: 'Puntos', rwBonus: 'Anuncio: +4 granos en la bolsa', oldBest: 'Récord anterior', migrated: 'Juego actualizado: ahora es DRIFTSTAIR, con arena suelta; el nuevo récord empieza de cero',
      clear: 'PUERTA ALCANZADA', bonus: 'Bono', btime: 'tiempo', bsand: 'arena', nextUp: 'espacio / toca — seguir', bury: 'ENTERRADO', life: '+1 VIDA', dig: 'Cavar', pour: 'Verter', go: '¡A LA PUERTA!',
      tut1: 'Mantén ⛏ para cavar la arena de delante, ▼ para verter un grano. Vierte un escalón junto al muro y sube a la repisa de la puerta', tut1b: 'Stick arriba / abajo + ⛏ cava encima / debajo de ti. La bolsa admite 12 granos',
      tut2: '¡Pinchos! Quédate en el borde y vierte hacia delante hasta rellenar el foso', tut3: 'La arena resbala a 45°: vierte escalones junto al muro, cada uno una celda más alto',
      tut4: '¡Un cangrejo! Tocarlo cuesta una vida. Un grano que cae desde arriba lo entierra: ponte en el borde y vierte cuando esté debajo', tut5: 'La cascada de arena no para: llena la bolsa y rellena el foso. No te quedes bajo el chorro',
      tut6: 'El escorpión te sigue. Ponte en el borde: se detiene en el muro bajo el desnivel — vierte sobre él desde arriba', tut7: 'Todo junto: la cascada da arena, pero no hay vuelta atrás. Cuenta tus granos',
      tutK1: 'Z / Espacio cava la arena de delante, X vierte un grano. Vierte un escalón junto al muro y sube a la repisa de la puerta', tutK1b: 'Flecha arriba / abajo + Z cava encima / debajo de ti. La bolsa admite 12 granos',
      hint: 'Flechas: mover · Z / Espacio: cavar · X: verter · P: pausa', hintTouch: 'Stick: mover · ⛏ cavar · ▼ verter · II: pausa',
      foot: '<b>DRIFTSTAIR</b> · flechas/WASD: mover, Z/Espacio: cavar, X: verter · flecha arriba/abajo + Z: cavar arriba/abajo · P/Esc: pausa · L idioma, T tema, M sonido'
    },
    pt: {
      play: 'Jogar', language: 'Idioma', theme: 'Tema', sound: 'Som', on: 'sim', off: 'não', score: 'Pontos', level: 'Nível', best: 'Recorde',
      win: 'TODAS AS DUNAS VENCIDAS!', gameover: 'SOTERRADO', pause: 'PAUSA', resume: 'Continuar', menu: 'Menu', tapstart: 'espaço / toque',
      title: 'DRIFTSTAIR', subtitle: 'Areia solta: cave, despeje, enterre', back: 'Catálogo', lives: 'Vidas', sand: 'Areia', retry: 'Reiniciar (−1 vida)',
      lb: 'Classificação', lbAll: 'Pontos', rwBonus: 'Anúncio: +4 grãos na bolsa', oldBest: 'Recorde anterior', migrated: 'Jogo atualizado: agora é DRIFTSTAIR, com areia solta; o novo recorde começa do zero',
      clear: 'PORTA ALCANÇADA', bonus: 'Bônus', btime: 'tempo', bsand: 'areia', nextUp: 'espaço / toque — seguir', bury: 'SOTERRADO', life: '+1 VIDA', dig: 'Cavar', pour: 'Despejar', go: 'À PORTA!',
      tut1: 'Segure ⛏ para cavar a areia à frente, ▼ para despejar um grão. Despeje um degrau junto à parede e suba à saliência da porta', tut1b: 'Stick para cima / baixo + ⛏ cava acima / abaixo de você. A bolsa leva 12 grãos',
      tut2: 'Espinhos! Fique na borda e despeje à frente até encher o fosso até o fundo', tut3: 'A areia escorrega a 45°: despeje degraus junto à parede, cada um uma célula mais alto',
      tut4: 'Um caranguejo! Tocar nele custa uma vida. Um grão caindo de cima o soterra: fique na borda e despeje quando ele estiver embaixo', tut5: 'A cascata de areia não para: encha a bolsa e o fosso. Não fique sob o jato',
      tut6: 'O escorpião segue você. Fique na borda: ele para na parede sob o desnível — despeje nele de cima', tut7: 'Tudo junto: a cascata dá areia, mas não há volta acima. Conte os grãos',
      tutK1: 'Z / Espaço cava a areia à frente, X despeja um grão. Despeje um degrau junto à parede e suba à saliência da porta', tutK1b: 'Seta para cima / baixo + Z cava acima / abaixo de você. A bolsa leva 12 grãos',
      hint: 'Setas: mover · Z / Espaço: cavar · X: despejar · P: pausa', hintTouch: 'Stick: mover · ⛏ cavar · ▼ despejar · II: pausa',
      foot: '<b>DRIFTSTAIR</b> · setas/WASD: mover, Z/Espaço: cavar, X: despejar · seta cima/baixo + Z: cavar acima/abaixo · P/Esc: pausa · L idioma, T tema, M som'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);

/* КАТЫШ · строки RU/EN/TR/ES/PT (движок v2.8 берёт языки из ключей strings). Название: RU — КАТЫШ, EN/TR/ES/PT — SEEDGLIDE
   (одно имя внутри языка, Яндекс 5.1.3). Ключи play/language/theme/… — для экранов движка, остальные — игре.
   TR/ES/PT — перевод ИИ по глоссарию tools/i18n-glossary.md; носитель не вычитывал. */
(function (global) {
  'use strict';
  var KT = global.KATYSH = global.KATYSH || {};
  KT.STR = {
    ru: {
      play: 'Играть', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл', score: 'Счёт', level: 'Гумно', best: 'Рекорд',
      win: 'ВСЕ ГУМНА ЧИСТЫ!', gameover: 'КОТЫ ПОБЕДИЛИ', pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      title: 'КАТЫШ', subtitle: 'Хомяк в шаре · катись до стены, собери семечки', back: 'Каталог', lives: 'Жизни',
      lb: 'Лидеры', lbAll: 'Очки', rwBonus: 'Реклама: щит от кота', oldBest: 'Прежний рекорд', migrated: 'Игра обновлена: теперь это «КАТЫШ», новый рекорд — с нуля',
      clear: 'ГУМНО ЧИСТО', seeds: 'Семечки', brake: 'Тормоз', life: '+1 ЖИЗНЬ', caught: 'ПОПАЛСЯ', shield: 'ЩИТ', chain: 'НАКАТ', go: 'КАТИСЬ!', bonus: 'Бонус', nextUp: 'пробел / тап — дальше',
      tut1: 'Тронь стик в любую сторону — шар катится до стены', tut2: 'Стог останавливает шар. Собери все семечки',
      tut3: 'Кот! ◆ тормоз — шар встанет на ближайшей клетке', tut4: 'Ловчий кот прыгает вдоль линии — уйди с неё',
      tutK1: 'Стрелки — шар катится до стены', tutK2: 'Стог останавливает шар. Собери все семечки',
      tutK3: 'Кот! Пробел — тормоз: шар встанет на ближайшей клетке', tutK4: 'Ловчий кот прыгает вдоль линии — уйди с неё',
      hint: 'Стрелки — катиться · Пробел — тормоз · P — пауза', hintTouch: 'Стик — катиться · ◆ тормоз · II — пауза',
      foot: '<b>КАТЫШ</b> · стрелки/WASD — катиться до стены, Пробел — тормоз · P/Esc — пауза · L язык, T тема, M звук'
    },
    en: {
      play: 'Play', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off', score: 'Score', level: 'Barn', best: 'Best',
      win: 'ALL BARNS CLEARED!', gameover: 'THE CATS WON', pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      title: 'SEEDGLIDE', subtitle: 'A hamster in a ball · roll to the wall, gather the seeds', back: 'Catalog', lives: 'Lives',
      lb: 'Leaderboard', lbAll: 'Score', rwBonus: 'Watch ad: cat shield', oldBest: 'Previous best', migrated: 'Game updated: now it is SEEDGLIDE, new best starts from zero',
      clear: 'BARN CLEARED', seeds: 'Seeds', brake: 'Brake', life: '+1 LIFE', caught: 'CAUGHT', shield: 'SHIELD', chain: 'ROLL', go: 'ROLL!', bonus: 'Bonus', nextUp: 'space / tap — next',
      tut1: 'Touch the stick in any direction: the ball rolls to the wall', tut2: 'Hay stops the ball. Gather every seed',
      tut3: 'A cat! ◆ brake: the ball stops on the next tile', tut4: 'The hunter cat pounces along a line: step off it',
      tutK1: 'Arrow keys: the ball rolls to the wall', tutK2: 'Hay stops the ball. Gather every seed',
      tutK3: 'A cat! Space is the brake: the ball stops on the next tile', tutK4: 'The hunter cat pounces along a line: step off it',
      hint: 'Arrows: roll · Space: brake · P: pause', hintTouch: 'Stick: roll · ◆ brake · II: pause',
      foot: '<b>SEEDGLIDE</b> · arrows/WASD: roll to the wall, Space: brake · P/Esc: pause · L language, T theme, M sound'
    },
    tr: {
      play: 'Oyna', language: 'Dil', theme: 'Tema', sound: 'Ses', on: 'açık', off: 'kapalı', score: 'Skor', level: 'Ambar', best: 'Rekor',
      win: 'TÜM AMBARLAR TEMİZ!', gameover: 'KEDİLER KAZANDI', pause: 'DURAKLAT', resume: 'Devam', menu: 'Menü', tapstart: 'boşluk / dokun',
      title: 'SEEDGLIDE', subtitle: 'Topun içinde hamster · duvara kadar yuvarlan, çekirdekleri topla', back: 'Katalog', lives: 'Can',
      lb: 'Sıralama', lbAll: 'Puan', rwBonus: 'Reklam: kediye karşı kalkan', oldBest: 'Önceki rekor', migrated: 'Oyun güncellendi: artık SEEDGLIDE, yeni rekor sıfırdan başlar',
      clear: 'AMBAR TEMİZ', seeds: 'Çekirdek', brake: 'Fren', life: '+1 CAN', caught: 'YAKALANDIN', shield: 'KALKAN', chain: 'YUVARLAN', go: 'YUVARLAN!', bonus: 'Bonus', nextUp: 'boşluk / dokun — devam',
      tut1: 'Çubuğa istediğin yöne dokun: top duvara kadar yuvarlanır', tut2: 'Saman topu durdurur. Tüm çekirdekleri topla',
      tut3: 'Kedi! ◆ fren: top yakındaki karede durur', tut4: 'Avcı kedi çizgi boyunca atlar: çizgiden çık',
      tutK1: 'Ok tuşları: top duvara kadar yuvarlanır', tutK2: 'Saman topu durdurur. Tüm çekirdekleri topla',
      tutK3: 'Kedi! Boşluk fren: top yakındaki karede durur', tutK4: 'Avcı kedi çizgi boyunca atlar: çizgiden çık',
      hint: 'Oklar: yuvarlan · Boşluk: fren · P: duraklat', hintTouch: 'Çubuk: yuvarlan · ◆ fren · II: duraklat',
      foot: '<b>SEEDGLIDE</b> · oklar/WASD: duvara kadar yuvarlan, Boşluk: fren · P/Esc: duraklat · L dil, T tema, M ses'
    },
    es: {
      play: 'Jugar', language: 'Idioma', theme: 'Tema', sound: 'Sonido', on: 'sí', off: 'no', score: 'Puntos', level: 'Granero', best: 'Récord',
      win: '¡TODOS LOS GRANEROS LIMPIOS!', gameover: 'GANARON LOS GATOS', pause: 'PAUSA', resume: 'Continuar', menu: 'Menú', tapstart: 'espacio / toca',
      title: 'SEEDGLIDE', subtitle: 'Un hámster en una bola · rueda hasta la pared y junta las semillas', back: 'Catálogo', lives: 'Vidas',
      lb: 'Clasificación', lbAll: 'Puntos', rwBonus: 'Anuncio: escudo antigatos', oldBest: 'Récord anterior', migrated: 'Juego actualizado: ahora es SEEDGLIDE, el nuevo récord empieza de cero',
      clear: 'GRANERO LIMPIO', seeds: 'Semillas', brake: 'Freno', life: '+1 VIDA', caught: 'ATRAPADO', shield: 'ESCUDO', chain: 'RODADA', go: '¡RUEDA!', bonus: 'Bono', nextUp: 'espacio / toca — seguir',
      tut1: 'Toca el stick en cualquier dirección: la bola rueda hasta la pared', tut2: 'La paja detiene la bola. Junta todas las semillas',
      tut3: '¡Un gato! ◆ freno: la bola se detiene en la casilla siguiente', tut4: 'El gato cazador salta en línea recta: sal de ella',
      tutK1: 'Flechas: la bola rueda hasta la pared', tutK2: 'La paja detiene la bola. Junta todas las semillas',
      tutK3: '¡Un gato! Espacio es el freno: la bola se detiene en la casilla siguiente', tutK4: 'El gato cazador salta en línea recta: sal de ella',
      hint: 'Flechas: rodar · Espacio: freno · P: pausa', hintTouch: 'Stick: rodar · ◆ freno · II: pausa',
      foot: '<b>SEEDGLIDE</b> · flechas/WASD: rueda hasta la pared, Espacio: freno · P/Esc: pausa · L idioma, T tema, M sonido'
    },
    pt: {
      play: 'Jogar', language: 'Idioma', theme: 'Tema', sound: 'Som', on: 'sim', off: 'não', score: 'Pontos', level: 'Celeiro', best: 'Recorde',
      win: 'TODOS OS CELEIROS LIMPOS!', gameover: 'OS GATOS VENCERAM', pause: 'PAUSA', resume: 'Continuar', menu: 'Menu', tapstart: 'espaço / toque',
      title: 'SEEDGLIDE', subtitle: 'Um hamster na bola · role até a parede e junte as sementes', back: 'Catálogo', lives: 'Vidas',
      lb: 'Classificação', lbAll: 'Pontos', rwBonus: 'Anúncio: escudo antigatos', oldBest: 'Recorde anterior', migrated: 'Jogo atualizado: agora é SEEDGLIDE, o novo recorde começa do zero',
      clear: 'CELEIRO LIMPO', seeds: 'Sementes', brake: 'Freio', life: '+1 VIDA', caught: 'PEGO', shield: 'ESCUDO', chain: 'ROLADA', go: 'ROLE!', bonus: 'Bônus', nextUp: 'espaço / toque — seguir',
      tut1: 'Toque no stick em qualquer direção: a bola rola até a parede', tut2: 'O feno para a bola. Junte todas as sementes',
      tut3: 'Um gato! ◆ freio: a bola para na próxima casa', tut4: 'O gato caçador salta em linha reta: saia dela',
      tutK1: 'Setas: a bola rola até a parede', tutK2: 'O feno para a bola. Junte todas as sementes',
      tutK3: 'Um gato! Espaço é o freio: a bola para na próxima casa', tutK4: 'O gato caçador salta em linha reta: saia dela',
      hint: 'Setas: rolar · Espaço: freio · P: pausa', hintTouch: 'Stick: rolar · ◆ freio · II: pausa',
      foot: '<b>SEEDGLIDE</b> · setas/WASD: role até a parede, Espaço: freio · P/Esc: pausa · L idioma, T tema, M som'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);

/* РОЙ · i18n (RU/EN/TR/ES/PT). ROY.STR — таблицы для Arcade.createGame({strings}).
   Ключи движка (play/language/…) + строки игры. Рендеры берут текст только через g.t().
   EN/TR/ES/PT-название — KINDLEBROOD (решение 26.11: у языков свои названия; TR/ES/PT — EN-название). */
(function (global) {
  'use strict';
  var R = global.ROY = global.ROY || {};
  R.STR = {
    ru: {
      play: 'Играть', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Счёт', level: 'Волна', best: 'Рекорд', win: 'РОЙ СГОРЕЛ!', gameover: 'КОНЕЦ ИГРЫ',
      pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      title: 'РОЙ', subtitle: 'Подожги рой — огонь пойдёт цепью',
      wave: 'ВОЛНА', ready: 'ГОТОВЬСЯ!', cleared: 'УЛЕЙ ПОГАШЕН', final: 'ПОСЛЕДНИЙ УЛЕЙ ПОГАШЕН!',
      gnat: 'Мошка', shell: 'Панцирник', powder: 'Пороховик', queen: 'Матка', chain: 'ЦЕПЬ', queenHp: 'МАТКА',
      ptsChain: '× место в цепи', ptsShell: 'два огня', ptsPowder: 'большой огонь', ptsQueen: 'гаси огнём рядом',
      tut1: 'Искра поджигает мошку — огонь перекинется на соседей',
      tut2: 'Манок: рой собьётся к нему в плотный клубок',
      tut3: 'Подожги клубок (или сам манок) — сгорит весь',
      tut4: 'Огонь рядом с Маткой ранит её — погаси улей',
      hint1: '● искра (Пробел)   ◆ манок (X)', hint2: 'стрелки / WASD — полёт · P пауза',
      hintTouch1: '● искра   ◆ манок', hintTouch2: 'стик — полёт · II пауза',
      rwLife: 'Реклама: +1 корабль', cardClear: 'УЛЕЙ ПОГАШЕН', cardNext: 'пробел / тап — дальше',
      migrated: 'Игра обновлена: новые правила, рекорд начат заново', oldBest: 'прежний рекорд',
      back: 'Каталог',
      foot: '<b>РОЙ</b> · стрелки / WASD — полёт, Пробел / ● — искра, X / ◆ — манок, P — пауза · L язык, T тема, M звук.'
    },
    en: {
      play: 'Play', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Score', level: 'Wave', best: 'Best', win: 'THE BROOD IS ASH!', gameover: 'GAME OVER',
      pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      title: 'KINDLEBROOD', subtitle: 'Light the brood and let the fire chain',
      wave: 'WAVE', ready: 'GET READY!', cleared: 'HIVE QUENCHED', final: 'LAST HIVE QUENCHED!',
      gnat: 'Gnat', shell: 'Shellback', powder: 'Powderbug', queen: 'Hive Mother', chain: 'CHAIN', queenHp: 'HIVE MOTHER',
      ptsChain: '× place in chain', ptsShell: 'two fires', ptsPowder: 'big blaze', ptsQueen: 'burn the brood near her',
      tut1: 'A spark lights a gnat — the fire jumps to its neighbours',
      tut2: 'The lure pulls the brood into a tight cluster',
      tut3: 'Light the cluster (or the lure itself) — it all burns',
      tut4: 'Fire next to the Hive Mother hurts her — quench the hive',
      hint1: '● spark (Space)   ◆ lure (X)', hint2: 'arrows / WASD — fly · P pause',
      hintTouch1: '● spark   ◆ lure', hintTouch2: 'stick — fly · II pause',
      rwLife: 'Watch ad: +1 ship', cardClear: 'HIVE QUENCHED', cardNext: 'space / tap — next',
      migrated: 'Game updated: new rules, record starts over', oldBest: 'old record',
      back: 'Catalog',
      foot: '<b>KINDLEBROOD</b> · arrows / WASD — fly, Space / ● — spark, X / ◆ — lure, P — pause · L language, T theme, M sound.'
    },
    tr: {
      play: 'Oyna', language: 'Dil', theme: 'Tema', sound: 'Ses', on: 'açık', off: 'kapalı',
      score: 'Skor', level: 'Dalga', best: 'Rekor', win: 'SÜRÜ KÜL OLDU!', gameover: 'OYUN BİTTİ',
      pause: 'DURAKLATILDI', resume: 'Devam', menu: 'Menü', tapstart: 'boşluk / dokun',
      title: 'KINDLEBROOD', subtitle: 'Sürüyü tutuştur, ateş zincirlensin',
      wave: 'DALGA', ready: 'HAZIR OL!', cleared: 'KOVAN SÖNDÜ', final: 'SON KOVAN SÖNDÜ!',
      gnat: 'Sinek', shell: 'Kabuklu', powder: 'Barutlu', queen: 'Ana Kovan', chain: 'ZİNCİR', queenHp: 'ANA KOVAN',
      ptsChain: '× zincirdeki sıra', ptsShell: 'iki ateş', ptsPowder: 'büyük alev', ptsQueen: 'yanındaki ateş yakar',
      tut1: 'Kıvılcım sineği tutuşturur — ateş komşulara geçer',
      tut2: 'Yem sürüyü sıkı bir kümeye toplar',
      tut3: 'Kümeyi (ya da yemi) tutuştur — hepsi yanar',
      tut4: 'Ana Kovanın yanındaki ateş onu yaralar',
      hint1: '● kıvılcım (Boşluk)   ◆ yem (X)', hint2: 'oklar / WASD — uç · P duraklat',
      hintTouch1: '● kıvılcım   ◆ yem', hintTouch2: 'çubuk — uç · II duraklat',
      rwLife: 'Reklam: +1 gemi', cardClear: 'KOVAN SÖNDÜ', cardNext: 'boşluk / dokun — devam',
      migrated: 'Oyun güncellendi: yeni kurallar, rekor sıfırlandı', oldBest: 'eski rekor',
      back: 'Katalog',
      foot: '<b>KINDLEBROOD</b> · oklar / WASD — uç, Boşluk / ● — kıvılcım, X / ◆ — yem, P — duraklat · L dil, T tema, M ses.'
    },
    es: {
      play: 'Jugar', language: 'Idioma', theme: 'Tema', sound: 'Sonido', on: 'sí', off: 'no',
      score: 'Puntos', level: 'Oleada', best: 'Récord', win: '¡EL ENJAMBRE ARDIÓ!', gameover: 'FIN DEL JUEGO',
      pause: 'PAUSA', resume: 'Seguir', menu: 'Menú', tapstart: 'espacio / toca',
      title: 'KINDLEBROOD', subtitle: 'Prende el enjambre y que el fuego encadene',
      wave: 'OLEADA', ready: '¡PREPÁRATE!', cleared: 'COLMENA APAGADA', final: '¡ÚLTIMA COLMENA APAGADA!',
      gnat: 'Mosquito', shell: 'Caparazón', powder: 'Polvorín', queen: 'Madre', chain: 'CADENA', queenHp: 'MADRE',
      ptsChain: '× puesto en la cadena', ptsShell: 'dos fuegos', ptsPowder: 'gran llama', ptsQueen: 'quema el fuego cercano',
      tut1: 'La chispa prende un mosquito — el fuego salta a los vecinos',
      tut2: 'El señuelo junta el enjambre en un racimo',
      tut3: 'Prende el racimo (o el señuelo) — arde entero',
      tut4: 'El fuego junto a la Madre la hiere — apaga la colmena',
      hint1: '● chispa (Espacio)   ◆ señuelo (X)', hint2: 'flechas / WASD — volar · P pausa',
      hintTouch1: '● chispa   ◆ señuelo', hintTouch2: 'palanca — volar · II pausa',
      rwLife: 'Anuncio: +1 nave', cardClear: 'COLMENA APAGADA', cardNext: 'espacio / toca — seguir',
      migrated: 'Juego actualizado: reglas nuevas, récord desde cero', oldBest: 'récord anterior',
      back: 'Catálogo',
      foot: '<b>KINDLEBROOD</b> · flechas / WASD — volar, Espacio / ● — chispa, X / ◆ — señuelo, P — pausa · L idioma, T tema, M sonido.'
    },
    pt: {
      play: 'Jogar', language: 'Idioma', theme: 'Tema', sound: 'Som', on: 'sim', off: 'não',
      score: 'Pontos', level: 'Onda', best: 'Recorde', win: 'O ENXAME VIROU CINZA!', gameover: 'FIM DE JOGO',
      pause: 'PAUSA', resume: 'Continuar', menu: 'Menu', tapstart: 'espaço / toque',
      title: 'KINDLEBROOD', subtitle: 'Acenda o enxame e deixe o fogo encadear',
      wave: 'ONDA', ready: 'PREPARE-SE!', cleared: 'COLMEIA APAGADA', final: 'ÚLTIMA COLMEIA APAGADA!',
      gnat: 'Mosquito', shell: 'Carapaça', powder: 'Pólvora', queen: 'Mãe', chain: 'CADEIA', queenHp: 'MÃE',
      ptsChain: '× lugar na cadeia', ptsShell: 'dois fogos', ptsPowder: 'chama grande', ptsQueen: 'o fogo perto a fere',
      tut1: 'A faísca acende um mosquito — o fogo pula para os vizinhos',
      tut2: 'A isca junta o enxame num bolo apertado',
      tut3: 'Acenda o bolo (ou a própria isca) — tudo queima',
      tut4: 'Fogo perto da Mãe a fere — apague a colmeia',
      hint1: '● faísca (Espaço)   ◆ isca (X)', hint2: 'setas / WASD — voar · P pausa',
      hintTouch1: '● faísca   ◆ isca', hintTouch2: 'alavanca — voar · II pausa',
      rwLife: 'Anúncio: +1 nave', cardClear: 'COLMEIA APAGADA', cardNext: 'espaço / toque — seguir',
      migrated: 'Jogo atualizado: novas regras, recorde do zero', oldBest: 'recorde antigo',
      back: 'Catálogo',
      foot: '<b>KINDLEBROOD</b> · setas / WASD — voar, Espaço / ● — faísca, X / ◆ — isca, P — pausa · L idioma, T tema, M som.'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);

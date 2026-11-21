/* РАЗРЕЗ · i18n (RU/EN/TR/ES/PT — движок v2.8 берёт языки из ключей strings; название: RU — РАЗРЕЗ, EN/TR/ES/PT — SLICEWARD).
   RAZREZ.STR — таблицы для Arcade.createGame({strings}). Ключи play/language/theme/... нужны стандартным экранам движка. */
(function (global) {
  'use strict';
  var R = global.RAZREZ = global.RAZREZ || {};
  R.STR = {
    ru: {
      play: 'Играть', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Счёт', level: 'Ур.', best: 'Рекорд', win: 'ПОЛЕ РАЗРЕЗАНО!', gameover: 'РЕЗЕЦ СЛОМАН',
      pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      title: 'РАЗРЕЗ', subtitle: 'Отрежь 75% поля · 5 уровней',
      back: 'Каталог', captured: 'Захват', goal: 'цель', lives: 'Жизни',
      ready: 'УРОВЕНЬ', readySub: 'Отрежь 75% поля. Шары не должны задеть след.',
      clear: 'УРОВЕНЬ ПРОЙДЕН', bonus: 'Бонус', lost: 'СЛЕД ПЕРЕРЕЗАН',
      cardNext: 'пробел / тап — дальше', rwLife: 'Реклама: +1 жизнь',
      hint: 'Стрелки/WASD: ход · P: пауза · T: тема · L: язык · M: звук',
      hintTouch: '▲ ◀ ▼ ▶ — ход · II — пауза',
      foot: 'Уходи с суши в поле и возвращайся — отрезанная часть без шаров станет твоей. Шары рвут след, клещи ползают по суше.'
    },
    en: {
      play: 'Play', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Score', level: 'Lvl', best: 'Best', win: 'FIELD CUT!', gameover: 'CUTTER BROKEN',
      pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      title: 'SLICEWARD', subtitle: 'Cut off 75% of the field · 5 levels',
      back: 'Catalog', captured: 'Claimed', goal: 'goal', lives: 'Lives',
      ready: 'LEVEL', readySub: 'Claim 75% of the field. Keep orbs off your trail.',
      clear: 'LEVEL CLEAR', bonus: 'Bonus', lost: 'TRAIL CUT',
      cardNext: 'space / tap — go on', rwLife: 'Watch ad: +1 life',
      hint: 'Arrows/WASD: move · P: pause · T: theme · L: language · M: sound',
      hintTouch: '▲ ◀ ▼ ▶ — move · II — pause',
      foot: 'Leave the land, cross the field and come back — every orb-free part you cut off is yours. Orbs break the trail, mites crawl the land.'
    },
    tr: {
      play: 'Oyna', language: 'Dil', theme: 'Tema', sound: 'Ses', on: 'açık', off: 'kapalı',
      score: 'Puan', level: 'Sv.', best: 'Rekor', win: 'ALAN KESİLDİ!', gameover: 'KESİCİ KIRILDI',
      pause: 'DURAKLATILDI', resume: 'Devam et', menu: 'Ana menü', tapstart: 'boşluk / dokun',
      title: 'SLICEWARD', subtitle: 'Alanın %75’ini kes · 5 seviye',
      back: 'Katalog', captured: 'Alan', goal: 'hedef', lives: 'Can',
      ready: 'SEVİYE', readySub: 'Alanın %75’ini al. Küreler izine değmesin.',
      clear: 'SEVİYE TAMAM', bonus: 'Bonus', lost: 'İZ KESİLDİ',
      cardNext: 'boşluk / dokun — devam', rwLife: 'Reklam: +1 can',
      hint: 'Oklar/WASD: hareket · P: duraklat · T: tema · L: dil · M: ses',
      hintTouch: '▲ ◀ ▼ ▶ — hareket · II — duraklat',
      foot: 'Karadan alana çık ve geri dön: içinde küre olmayan kestiğin her parça senin olur. Küreler izi koparır, akarlar karada dolaşır.'
    },
    es: {
      play: 'Jugar', language: 'Idioma', theme: 'Tema', sound: 'Sonido', on: 'sí', off: 'no',
      score: 'Puntos', level: 'Niv.', best: 'Récord', win: '¡CAMPO CORTADO!', gameover: 'CORTADOR ROTO',
      pause: 'PAUSA', resume: 'Continuar', menu: 'Menú principal', tapstart: 'espacio / toca',
      title: 'SLICEWARD', subtitle: 'Corta el 75% del campo · 5 niveles',
      back: 'Catálogo', captured: 'Zona', goal: 'meta', lives: 'Vidas',
      ready: 'NIVEL', readySub: 'Gana el 75% del campo. Que las bolas no toquen tu rastro.',
      clear: 'NIVEL SUPERADO', bonus: 'Bonus', lost: 'RASTRO CORTADO',
      cardNext: 'espacio / toca — seguir', rwLife: 'Anuncio: +1 vida',
      hint: 'Flechas/WASD: mover · P: pausa · T: tema · L: idioma · M: sonido',
      hintTouch: '▲ ◀ ▼ ▶ — mover · II — pausa',
      foot: 'Sal de tierra firme, cruza el campo y vuelve: cada parte sin bolas que cortes será tuya. Las bolas rompen el rastro y los ácaros recorren la tierra.'
    },
    pt: {
      play: 'Jogar', language: 'Idioma', theme: 'Tema', sound: 'Som', on: 'lig.', off: 'desl.',
      score: 'Pontos', level: 'Nív.', best: 'Recorde', win: 'CAMPO CORTADO!', gameover: 'CORTADOR QUEBRADO',
      pause: 'PAUSA', resume: 'Continuar', menu: 'Menu principal', tapstart: 'espaço / toque',
      title: 'SLICEWARD', subtitle: 'Corte 75% do campo · 5 fases',
      back: 'Catálogo', captured: 'Área', goal: 'meta', lives: 'Vidas',
      ready: 'FASE', readySub: 'Conquiste 75% do campo. As bolas não podem tocar o rastro.',
      clear: 'FASE CONCLUÍDA', bonus: 'Bônus', lost: 'RASTRO CORTADO',
      cardNext: 'espaço / toque — seguir', rwLife: 'Anúncio: +1 vida',
      hint: 'Setas/WASD: mover · P: pausa · T: tema · L: idioma · M: som',
      hintTouch: '▲ ◀ ▼ ▶ — mover · II — pausa',
      foot: 'Saia da terra firme, cruze o campo e volte: cada parte sem bolas que você cortar fica sua. As bolas rompem o rastro e os ácaros andam pela terra.'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);

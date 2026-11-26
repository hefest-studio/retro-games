/* УДАЛЕЦ · i18n (RU/EN/TR/ES/PT — движок v2.8 берёт языки из ключей strings; название: RU — УДАЛЕЦ, EN/TR/ES/PT — BELLOWKIN).
   UDALETS.STR — таблицы для Arcade.createGame({strings}). Ключи play/language/theme/... нужны стандартным экранам движка; остальные — игре.
   Переводы TR/ES/PT — ИИ, носитель не вычитывал. */
(function (global) {
  'use strict';
  var U = global.UDALETS = global.UDALETS || {};
  U.STR = {
    ru: {
      play: 'Играть', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Счёт', level: 'Уровень', best: 'Рекорд', lives: 'Жизни',
      win: 'ЦЕХА ОЖИЛИ!', gameover: 'УДАЛЕЦ ВЫБЫЛ',
      pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      title: 'УДАЛЕЦ', subtitle: 'Раздуй остывшие горны мастерской «Гефест»',
      sub2: 'Подмастерье с кузнечными мехами · 10 цехов',
      back: 'Каталог',
      lv1: 'Старый цех', lv2: 'Кузня', lv3: 'Литейная', lv4: 'Кислотные чаны', lv5: 'Трубный ярус',
      lv6: 'Башня ветров', lv7: 'Часовой механизм', lv8: 'Котельная', lv9: 'Шпиль', lv10: 'Горн Мастера',
      intro: 'Раздуй все горны цеха', left: 'осталось горнов', lit: 'Горн пылает!', heat: 'жар',
      clear: 'ЦЕХ ОЖИЛ', timeBonus: 'бонус', life: '+жизнь!', vane: 'заслонки подняты', stun: 'оглушён',
      furnL: 'ГОРНЫ', sec: 'с', rwLife: 'Реклама: +1 жизнь', cardDone: 'ЦЕХ ОЖИЛ', cardNext: 'пробел / тап — следующий цех',
      hint: '←→ ходить · ↑/Пробел прыжок · X выдох мехов (↓ — вниз) · P пауза',
      foot: '<b>УДАЛЕЦ</b> · ← → / A D — ходить · ↑ / W / Пробел / Z — прыжок · X / K / Ctrl / F — выдох мехов (с ↓ — вниз: в прыжке — подскок) · P / Esc — пауза · L язык, T тема, M звук. Тач — стик, ● прыжок, ◆ выдох.'
    },
    en: {
      play: 'Play', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Score', level: 'Level', best: 'Best', lives: 'Lives',
      win: 'THE WORKSHOPS ARE ALIVE!', gameover: 'THE APPRENTICE IS OUT',
      pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      title: 'BELLOWKIN', subtitle: 'Fan the cold forges of the Hefest workshop back to life',
      sub2: 'An apprentice with forge bellows · 10 workshops',
      back: 'Catalog',
      lv1: 'Old Workshop', lv2: 'Smithy', lv3: 'Foundry', lv4: 'Acid Vats', lv5: 'Pipe Deck',
      lv6: 'Tower of Winds', lv7: 'Clockwork', lv8: 'Boiler Room', lv9: 'The Spire', lv10: 'Master Forge',
      intro: 'Fan every forge in the workshop', left: 'forges left', lit: 'The forge is ablaze!', heat: 'heat',
      clear: 'WORKSHOP ALIVE', timeBonus: 'bonus', life: '+life!', vane: 'shutters raised', stun: 'stunned',
      furnL: 'FORGES', sec: 's', rwLife: 'Watch ad: +1 life', cardDone: 'WORKSHOP ALIVE', cardNext: 'space / tap — next workshop',
      hint: '←→ walk · ↑/Space jump · X bellows (↓ — down) · P pause',
      foot: '<b>BELLOWKIN</b> · ← → / A D — walk · ↑ / W / Space / Z — jump · X / K / Ctrl / F — bellows puff (with ↓ — downwards: a boost mid-jump) · P / Esc — pause · L language, T theme, M sound. Touch — stick, ● jump, ◆ puff.'
    },
    tr: {
      play: 'Oyna', language: 'Dil', theme: 'Tema', sound: 'Ses', on: 'açık', off: 'kapalı',
      score: 'Puan', level: 'Seviye', best: 'Rekor', lives: 'Can',
      win: 'ATÖLYELER CANLANDI!', gameover: 'ÇIRAK OYUN DIŞI',
      pause: 'DURAKLATILDI', resume: 'Devam et', menu: 'Ana menü', tapstart: 'boşluk / dokun',
      title: 'BELLOWKIN', subtitle: 'Hefest atölyesinin soğuk ocaklarını körükle canlandır',
      sub2: 'Körüklü bir çırak · 10 atölye',
      back: 'Katalog',
      lv1: 'Eski atölye', lv2: 'Demirhane', lv3: 'Dökümhane', lv4: 'Asit kazanları', lv5: 'Boru katı',
      lv6: 'Rüzgâr kulesi', lv7: 'Saat mekanizması', lv8: 'Kazan dairesi', lv9: 'Kule tepesi', lv10: 'Usta ocağı',
      intro: 'Atölyedeki tüm ocakları körükle', left: 'ocak kaldı', lit: 'Ocak alev aldı!', heat: 'ısı',
      clear: 'ATÖLYE CANLANDI', timeBonus: 'bonus', life: '+can!', vane: 'kapaklar açıldı', stun: 'sersem',
      furnL: 'OCAKLAR', sec: 'sn', rwLife: 'Reklam: +1 can', cardDone: 'ATÖLYE CANLANDI', cardNext: 'boşluk / dokun — sonraki atölye',
      hint: '←→ yürü · ↑/Boşluk zıpla · X körük (↓ — aşağı) · P duraklat',
      foot: '<b>BELLOWKIN</b> · ← → / A D — yürü · ↑ / W / Boşluk / Z — zıpla · X / K / Ctrl / F — körük üfle (↓ ile aşağı: zıplarken yükselir) · P / Esc — duraklat · L dil, T tema, M ses. Dokunmatik — çubuk, ● zıpla, ◆ üfle.'
    },
    es: {
      play: 'Jugar', language: 'Idioma', theme: 'Tema', sound: 'Sonido', on: 'sí', off: 'no',
      score: 'Puntos', level: 'Nivel', best: 'Récord', lives: 'Vidas',
      win: '¡LOS TALLERES REVIVEN!', gameover: 'EL APRENDIZ ESTÁ FUERA',
      pause: 'PAUSA', resume: 'Continuar', menu: 'Menú principal', tapstart: 'espacio / toca',
      title: 'BELLOWKIN', subtitle: 'Aviva las fraguas frías del taller Hefest',
      sub2: 'Un aprendiz con fuelle de herrero · 10 talleres',
      back: 'Catálogo',
      lv1: 'Taller viejo', lv2: 'Herrería', lv3: 'Fundición', lv4: 'Cubas de ácido', lv5: 'Piso de tuberías',
      lv6: 'Torre de vientos', lv7: 'Relojería', lv8: 'Sala de calderas', lv9: 'La aguja', lv10: 'Fragua Maestra',
      intro: 'Aviva todas las fraguas del taller', left: 'fraguas restantes', lit: '¡La fragua arde!', heat: 'calor',
      clear: 'EL TALLER REVIVE', timeBonus: 'bonus', life: '+vida!', vane: 'compuertas abiertas', stun: 'aturdido',
      furnL: 'FRAGUAS', sec: 's', rwLife: 'Anuncio: +1 vida', cardDone: 'EL TALLER REVIVE', cardNext: 'espacio / toca — siguiente taller',
      hint: '←→ andar · ↑/Espacio salto · X fuelle (↓ — abajo) · P pausa',
      foot: '<b>BELLOWKIN</b> · ← → / A D — andar · ↑ / W / Espacio / Z — salto · X / K / Ctrl / F — soplo del fuelle (con ↓ hacia abajo: impulso en el salto) · P / Esc — pausa · L idioma, T tema, M sonido. Táctil — stick, ● salto, ◆ soplo.'
    },
    pt: {
      play: 'Jogar', language: 'Idioma', theme: 'Tema', sound: 'Som', on: 'lig.', off: 'desl.',
      score: 'Pontos', level: 'Nível', best: 'Recorde', lives: 'Vidas',
      win: 'AS OFICINAS REVIVERAM!', gameover: 'O APRENDIZ ESTÁ FORA',
      pause: 'PAUSA', resume: 'Continuar', menu: 'Menu principal', tapstart: 'espaço / toque',
      title: 'BELLOWKIN', subtitle: 'Reacenda as forjas frias da oficina Hefest',
      sub2: 'Um aprendiz com fole de ferreiro · 10 oficinas',
      back: 'Catálogo',
      lv1: 'Oficina velha', lv2: 'Ferraria', lv3: 'Fundição', lv4: 'Tanques de ácido', lv5: 'Andar dos canos',
      lv6: 'Torre dos ventos', lv7: 'Relojoaria', lv8: 'Casa das caldeiras', lv9: 'O pináculo', lv10: 'Forja Mestra',
      intro: 'Reacenda todas as forjas da oficina', left: 'forjas restantes', lit: 'A forja está em brasa!', heat: 'calor',
      clear: 'A OFICINA REVIVEU', timeBonus: 'bônus', life: '+vida!', vane: 'comportas abertas', stun: 'tonto',
      furnL: 'FORJAS', sec: 's', rwLife: 'Anúncio: +1 vida', cardDone: 'A OFICINA REVIVEU', cardNext: 'espaço / toque — próxima oficina',
      hint: '←→ andar · ↑/Espaço pulo · X fole (↓ — para baixo) · P pausa',
      foot: '<b>BELLOWKIN</b> · ← → / A D — andar · ↑ / W / Espaço / Z — pulo · X / K / Ctrl / F — sopro do fole (com ↓ para baixo: impulso no pulo) · P / Esc — pausa · L idioma, T tema, M som. Toque — stick, ● pulo, ◆ sopro.'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);

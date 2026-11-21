/* ТАЙНИК · i18n (RU/EN/TR/ES/PT — движок v2.8 берёт языки из ключей strings; название: RU — ТАЙНИК, EN/TR/ES/PT — ROPEWARD). TAYNIK.STR — таблицы для Arcade.createGame({strings}).
   Ключи play/language/theme/... нужны стандартным экранам движка; остальные — игре. */
(function (global) {
  'use strict';
  var K = global.TAYNIK = global.TAYNIK || {};
  K.STR = {
    ru: {
      play: 'Играть', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Счёт', level: 'Ур.', best: 'Рекорд', win: 'ВЫ ВЫБРАЛИСЬ НАВЕРХ!', gameover: 'ФОНАРЬ ПОГАС',
      pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      title: 'ТАЙНИК', subtitle: 'Подмастерье-фонарщик Светляк · водонапорная башня «Гефеста» · 6 ярусов',
      back: 'Каталог', lives: 'Жизни', energy: 'Сила', ammo: 'Заряды',
      ready: 'ЯРУС', readySub: 'Найди люк наверх · ↑ — прыжок и верёвка',
      clear: 'ЛЮК НАЙДЕН', bonus: 'Бонус', lost: 'ПОТЕРЯ', next: 'Следующий ярус',
      d_acid: 'Упал в кислоту', d_energy: 'Силы иссякли',
      t_gem: 'КАМЕНЬ', t_gear: 'ДЕТАЛЬ', t_ammo: 'ЗАРЯДЫ', t_oil: 'МАСЛО', t_map: 'КАРТА', t_lamp: 'ФОНАРЬ ЗАЖЖЁН',
      t_empty: 'ПУСТО!', t_extra: '+1 ЖИЗНЬ', t_reveal: 'ХАМЕЛЕОН!',
      e_spider: 'паук', e_spark: 'искра', e_ghost: 'призрак', e_cham: 'хамелеон',
      lv_1: 'Подвал', lv_2: 'Насосная', lv_3: 'Трубный ярус', lv_4: 'Котельная', lv_5: 'Паровой ярус', lv_6: 'Под баком',
      hintmap: 'КАРТА', exit: 'ВЫХОД',
      lvPick: 'Ярус', starNew: 'новый рекорд звёзд!', starsHint: '★ люк · ★ без потерь · ★ все камни', rwBoost: 'Реклама: полные заряды и сила',
      hint: '←→ шаг · ↑ прыжок / по верёвке · ↓ вниз · пробел — выстрел · P — пауза',
      foot: '<b>ТАЙНИК</b> · ←→ / AD — шаг · ↑ / W — прыжок, хват и подъём по верёвке · ↓ / S — спуск · на верёвке ←/→ — прыжок с неё · пробел / Z — выстрел · P/Esc — пауза · L язык, T тема, M звук.'
    },
    en: {
      play: 'Play', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Score', level: 'Lvl', best: 'Best', win: 'YOU MADE IT TO THE TOP!', gameover: 'THE LANTERN WENT OUT',
      pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      title: 'ROPEWARD', subtitle: 'Svetlyak the lamplighter apprentice · the old water tower · 6 tiers',
      back: 'Catalog', lives: 'Lives', energy: 'Energy', ammo: 'Charges',
      ready: 'TIER', readySub: 'Find the hatch up · ↑ — jump and rope',
      clear: 'HATCH FOUND', bonus: 'Bonus', lost: 'LOST', next: 'Next tier',
      d_acid: 'Fell into the acid', d_energy: 'Out of energy',
      t_gem: 'GEM', t_gear: 'PART', t_ammo: 'CHARGES', t_oil: 'OIL', t_map: 'MAP', t_lamp: 'LAMP LIT',
      t_empty: 'EMPTY!', t_extra: '+1 LIFE', t_reveal: 'CHAMELEON!',
      e_spider: 'spider', e_spark: 'spark', e_ghost: 'ghost', e_cham: 'chameleon',
      lv_1: 'Cellar', lv_2: 'Pump room', lv_3: 'Pipe tier', lv_4: 'Boiler room', lv_5: 'Steam tier', lv_6: 'Under the tank',
      hintmap: 'MAP', exit: 'EXIT',
      lvPick: 'Tier', starNew: 'new star record!', starsHint: '★ hatch · ★ no losses · ★ all gems', rwBoost: 'Watch ad: full charges and energy',
      hint: '←→ step · ↑ jump / climb · ↓ down · space — shoot · P — pause',
      foot: '<b>ROPEWARD</b> · ←→ / AD — step · ↑ / W — jump, grab and climb a rope · ↓ / S — climb down · on a rope ←/→ — leap off · space / Z — shoot · P/Esc — pause · L language, T theme, M sound.'
    }
  };
  K.STR.tr = {
    play: 'Oyna', language: 'Dil', theme: 'Tema', sound: 'Ses', on: 'açık', off: 'kapalı',
    score: 'Puan', level: 'Kat', best: 'Rekor', win: 'TEPEYE ÇIKTIN!', gameover: 'FENER SÖNDÜ',
    pause: 'DURAKLATILDI', resume: 'Devam', menu: 'Menü', tapstart: 'boşluk / dokun',
    title: 'ROPEWARD', subtitle: 'Fenerci çırak Svetlyak · eski su kulesi · 6 kat',
    back: 'Katalog', lives: 'Can', energy: 'Güç', ammo: 'Şarj',
    ready: 'KAT', readySub: 'Yukarı kapağı bul · ↑ — zıpla ve ip',
    clear: 'KAPAK BULUNDU', bonus: 'Bonus', lost: 'KAYIP', next: 'Sonraki kat',
    d_acid: 'Asite düştü', d_energy: 'Güç bitti',
    t_gem: 'TAŞ', t_gear: 'PARÇA', t_ammo: 'ŞARJ', t_oil: 'YAĞ', t_map: 'HARİTA', t_lamp: 'FENER YANDI',
    t_empty: 'BOŞ!', t_extra: '+1 CAN', t_reveal: 'BUKALEMUN!',
    e_spider: 'örümcek', e_spark: 'kıvılcım', e_ghost: 'hayalet', e_cham: 'bukalemun',
    lv_1: 'Bodrum', lv_2: 'Pompa odası', lv_3: 'Boru katı', lv_4: 'Kazan dairesi', lv_5: 'Buhar katı', lv_6: 'Tankın altı',
    hintmap: 'HARİTA', exit: 'ÇIKIŞ',
    lvPick: 'Kat', starNew: 'yeni yıldız rekoru!', starsHint: '★ kapak · ★ kayıpsız · ★ tüm taşlar', rwBoost: 'Reklam: tam şarj ve güç',
    hint: '←→ adım · ↑ zıpla / tırman · ↓ aşağı · boşluk — ateş · P — duraklat',
    foot: '<b>ROPEWARD</b> · ←→ / AD — adım · ↑ / W — zıpla, ipi tut ve tırman · ↓ / S — in · ipte ←/→ — ipten atla · boşluk / Z — ateş · P/Esc — duraklat · L dil, T tema, M ses.'
  };
  K.STR.es = {
    play: 'Jugar', language: 'Idioma', theme: 'Tema', sound: 'Sonido', on: 'sí', off: 'no',
    score: 'Puntos', level: 'Niv.', best: 'Récord', win: '¡LLEGASTE A LA CIMA!', gameover: 'SE APAGÓ EL FAROL',
    pause: 'PAUSA', resume: 'Seguir', menu: 'Menú', tapstart: 'espacio / toca',
    title: 'ROPEWARD', subtitle: 'Svetlyak, aprendiz de farolero · la vieja torre de agua · 6 niveles',
    back: 'Catálogo', lives: 'Vidas', energy: 'Fuerza', ammo: 'Cargas',
    ready: 'NIVEL', readySub: 'Busca la trampilla · ↑ — salto y cuerda',
    clear: 'TRAMPILLA HALLADA', bonus: 'Bonus', lost: 'PÉRDIDA', next: 'Siguiente nivel',
    d_acid: 'Cayó al ácido', d_energy: 'Sin fuerzas',
    t_gem: 'GEMA', t_gear: 'PIEZA', t_ammo: 'CARGAS', t_oil: 'ACEITE', t_map: 'MAPA', t_lamp: 'FAROL ENCENDIDO',
    t_empty: '¡VACÍO!', t_extra: '+1 VIDA', t_reveal: '¡CAMALEÓN!',
    e_spider: 'araña', e_spark: 'chispa', e_ghost: 'fantasma', e_cham: 'camaleón',
    lv_1: 'Sótano', lv_2: 'Sala de bombas', lv_3: 'Nivel de tubos', lv_4: 'Sala de calderas', lv_5: 'Nivel de vapor', lv_6: 'Bajo el depósito',
    hintmap: 'MAPA', exit: 'SALIDA',
    lvPick: 'Nivel', starNew: '¡nuevo récord de estrellas!', starsHint: '★ trampilla · ★ sin pérdidas · ★ todas las gemas', rwBoost: 'Anuncio: cargas y fuerza al máximo',
    hint: '←→ paso · ↑ saltar / trepar · ↓ bajar · espacio — disparar · P — pausa',
    foot: '<b>ROPEWARD</b> · ←→ / AD — paso · ↑ / W — saltar, agarrar y subir por la cuerda · ↓ / S — bajar · en la cuerda ←/→ — saltar de ella · espacio / Z — disparar · P/Esc — pausa · L idioma, T tema, M sonido.'
  };
  K.STR.pt = {
    play: 'Jogar', language: 'Idioma', theme: 'Tema', sound: 'Som', on: 'lig.', off: 'desl.',
    score: 'Pontos', level: 'Nív.', best: 'Recorde', win: 'VOCÊ CHEGOU AO TOPO!', gameover: 'A LANTERNA APAGOU',
    pause: 'PAUSA', resume: 'Continuar', menu: 'Menu', tapstart: 'espaço / toque',
    title: 'ROPEWARD', subtitle: 'Svetlyak, aprendiz de acendedor · a velha caixa-d’água · 6 andares',
    back: 'Catálogo', lives: 'Vidas', energy: 'Força', ammo: 'Cargas',
    ready: 'ANDAR', readySub: 'Ache o alçapão · ↑ — pulo e corda',
    clear: 'ALÇAPÃO ACHADO', bonus: 'Bônus', lost: 'PERDA', next: 'Próximo andar',
    d_acid: 'Caiu no ácido', d_energy: 'Sem forças',
    t_gem: 'GEMA', t_gear: 'PEÇA', t_ammo: 'CARGAS', t_oil: 'ÓLEO', t_map: 'MAPA', t_lamp: 'LANTERNA ACESA',
    t_empty: 'VAZIO!', t_extra: '+1 VIDA', t_reveal: 'CAMALEÃO!',
    e_spider: 'aranha', e_spark: 'faísca', e_ghost: 'fantasma', e_cham: 'camaleão',
    lv_1: 'Porão', lv_2: 'Casa de bombas', lv_3: 'Andar dos canos', lv_4: 'Casa da caldeira', lv_5: 'Andar do vapor', lv_6: 'Sob o tanque',
    hintmap: 'MAPA', exit: 'SAÍDA',
    lvPick: 'Andar', starNew: 'novo recorde de estrelas!', starsHint: '★ alçapão · ★ sem perdas · ★ todas as gemas', rwBoost: 'Anúncio: cargas e força cheias',
    hint: '←→ passo · ↑ pular / subir · ↓ descer · espaço — atirar · P — pausa',
    foot: '<b>ROPEWARD</b> · ←→ / AD — passo · ↑ / W — pular, agarrar e subir na corda · ↓ / S — descer · na corda ←/→ — saltar dela · espaço / Z — atirar · P/Esc — pausa · L idioma, T tema, M som.'
  };
})(typeof window !== 'undefined' ? window : globalThis);

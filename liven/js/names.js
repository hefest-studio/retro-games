/* ЛИВЕНЬ · имена этапов, Звонарей и перезвонов на TR/ES/PT (RU/EN — в stages.js и patterns.js).
   Подключается ПОСЛЕ stages.js и patterns.js: дописывает n.tr / n.es / n.pt по EN-имени; чего нет — рендер берёт EN (LIVEN.nm). */
(function (global) {
  'use strict';
  var LV = global.LIVEN = global.LIVEN || {};
  var T = {
    // этапы
    'Rusty Belfry': ['Paslı Çan Kulesi', 'Campanario oxidado', 'Campanário enferrujado'],
    'Cloud Chute': ['Bulut Oluğu', 'Tobogán de nubes', 'Calha das nuvens'],
    'Lightning Belt': ['Şimşek Kuşağı', 'Cinturón de rayos', 'Cinturão de raios'],
    'Hail Gallery': ['Dolu Galerisi', 'Galería del granizo', 'Galeria do granizo'],
    'Belfry Above the Storm': ['Fırtına Üstü Kule', 'Campanario sobre la tormenta', 'Campanário sobre a tempestade'],
    // боссы
    'Sentry Jingle': ['Nöbetçi Zil', 'Cascabel centinela', 'Guizo sentinela'],
    'The Brass-Mouth Ringer': ['Pirinç Ağız Zilci', 'Campanero Boca de Latón', 'Sineiro Boca de Latão'],
    'Sieve Chime': ['Elek Çıngırak', 'Campanilla tamiz', 'Sininho peneira'],
    'The Gale Ringer': ['Bora Zilcisi', 'Campanero Vendaval', 'Sineiro Vendaval'],
    'Thunder Lantern': ['Gök Gürültüsü Feneri', 'Farol del trueno', 'Lanterna do trovão'],
    'The Sprue Ringer': ['Döküm Zilcisi', 'Campanero Colada', 'Sineiro Fundição'],
    'Hailstriker': ['Dolu Vuran', 'Golpeagranizo', 'Bate-granizo'],
    'The Boiling Ringer': ['Kaynayan Zilci', 'Campanero Hirviente', 'Sineiro Fervente'],
    'Belfry Warden': ['Kule Bekçisi', 'Guardián del campanario', 'Guardião do campanário'],
    'The Great Tocsin': ['Büyük Tehlike Çanı', 'El Gran Rebato', 'O Grande Rebate'],
    // перезвоны
    'First Rivets': ['İlk Perçinler', 'Primeros remaches', 'Primeiros rebites'],
    'Brass Drizzle': ['Pirinç Çisenti', 'Llovizna de latón', 'Garoa de latão'],
    'Scale Spiral': ['Tufal Sarmalı', 'Espiral de escoria', 'Espiral de escória'],
    'Heat Bloom': ['Kızgın Çiçek', 'Flor de calor', 'Flor de calor'],
    'Fine Hail': ['İnce Dolu', 'Granizo fino', 'Granizo fino'],
    'Gust': ['Rüzgâr Darbesi', 'Ráfaga', 'Rajada'],
    'Breath In, Breath Out': ['Nefes Al, Nefes Ver', 'Inhala, exhala', 'Inspira, expira'],
    'Whirling Petals': ['Dönen Yapraklar', 'Pétalos en remolino', 'Pétalas em redemoinho'],
    'Thunder Mesh': ['Gök Gürültüsü Ağı', 'Malla de trueno', 'Malha de trovão'],
    'Chain Lightning': ['Zincirleme Şimşek', 'Rayo en cadena', 'Raio em cadeia'],
    'Slanted Lattice': ['Eğik Kafes', 'Celosía oblicua', 'Treliça oblíqua'],
    'Twin Bells': ['İkiz Çanlar', 'Campanas gemelas', 'Sinos gêmeos'],
    'Riveted Star': ['Perçinli Yıldız', 'Estrella remachada', 'Estrela rebitada'],
    'Coin Chime': ['Sikke Çınlaması', 'Tintineo de monedas', 'Tilintar de moedas'],
    'Ice Grains': ['Buz Taneleri', 'Granos de hielo', 'Grãos de gelo'],
    'Downfall': ['Çöküş', 'Derrumbe', 'Desabamento'],
    'Boiling': ['Kaynama', 'Hervor', 'Fervura'],
    'Double Helix': ['Çift Sarmal', 'Doble hélice', 'Dupla hélice'],
    'Petal Rampart': ['Yaprak Siper', 'Muralla de pétalos', 'Muralha de pétalas'],
    'Downpour': ['Sağanak', 'Aguacero', 'Aguaceiro'],
    'Hammer Rebound': ['Çekiç Sekmesi', 'Rebote del martillo', 'Ricochete do martelo'],
    'Spark Fan': ['Kıvılcım Yelpazesi', 'Abanico de chispas', 'Leque de faíscas'],
    'Tocsin Strike': ['Tehlike Çanı Vuruşu', 'Toque de rebato', 'Toque de rebate'],
    'Sun Flower': ['Güneş Çiçeği', 'Flor solar', 'Flor solar'],
    'Steel Threads': ['Çelik İplikler', 'Hilos de acero', 'Fios de aço'],
    'Heavenly Downpour': ['Göksel Sağanak', 'Aguacero celestial', 'Aguaceiro celestial'],
    'Final Peal: Star of Hefest': ['Son Çınlama: Hefest Yıldızı', 'Último repique: Estrella de Hefest', 'Último repique: Estrela de Hefest']
  };
  var LANGS = ['tr', 'es', 'pt'];
  function patch(n) { var t = n && T[n.en]; if (!t) return; for (var i = 0; i < 3; i++) if (!n[LANGS[i]]) n[LANGS[i]] = t[i]; }
  (LV.STAGES || []).forEach(function (s) { patch(s.n); });
  var B = LV.BOSSES || {};
  Object.keys(B).forEach(function (id) { patch(B[id].n); (B[id].cards || []).forEach(function (c) { patch(c.n); }); });
  // имя на языке; нет — EN
  LV.nm = function (n, lang) { return n ? (n[lang] || n.en || n.ru || '') : ''; };
  LV.NAMES_X = T;
})(typeof window !== 'undefined' ? window : globalThis);

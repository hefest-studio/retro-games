#!/usr/bin/env node
/**
 * check-file-proto.mjs — проверка каталога в режиме double-click (file://), русской и английской страниц:
 * все карточки каталога, переключение темы, загрузка превью, переход по карточке на
 * file:///…/<slug>/index.html (на EN-странице — …/index.html?lang=en), а не на листинг папки, и возврат
 * из игры ссылкой «← Каталог» на ту же языковую страницу каталога (index.html / en/index.html).
 *
 * Запуск: node tools/qa/check-file-proto.mjs [--catalog /abs/path/index.html] [--out-dir DIR]
 *   без --catalog проверяются обе страницы: <репо>/index.html и <репо>/en/index.html.
 * Скриншоты — в tools/qa/reports/qa-shots/ (независимо от текущей папки). Код возврата 1 — есть провал.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, parseArgs } from './lib.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '');
const QA_SHOTS = fileURLToPath(new URL('./reports/qa-shots', import.meta.url));
const GAME_COUNT = JSON.parse(readFileSync(new URL('../../assets/catalog/games.json', import.meta.url), 'utf8')).games.length;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Ссылка карточки: RU — «<slug>/index.html», EN — «../<slug>/index.html?lang=en»
const CARD_RE = { ru: /^[a-z0-9-]+\/index\.html$/, en: /^\.\.\/[a-z0-9-]+\/index\.html\?lang=en$/ };

async function checkPage(session, catalog, outDir) {
  if (!existsSync(catalog)) throw new Error(`Нет файла ${catalog}`);
  const fileUrl = `file://${catalog}`;
  const out = { fileUrl, checks: {} };
  {
    session.consoleErrors.length = 0; session.pageErrors.length = 0;
    await session.goto(fileUrl, { wait: 1800 });
    const lang = (await session.evaluate(`document.documentElement.lang || 'ru'`)) === 'en' ? 'en' : 'ru';
    const tag = lang === 'en' ? 'catalog-file-en' : 'catalog-file';
    out.lang = lang;
    const base = await session.evaluate(`(() => {
      const cards = [...document.querySelectorAll('a[href]')].filter((a) => /\\/index\\.html(\\?[^#]*)?$/.test(a.getAttribute('href') || '') && a.closest('#game-grid'));
      return {
        title: document.title,
        theme: document.documentElement.getAttribute('data-theme'),
        cards: cards.length,
        hrefs: cards.map((a) => a.getAttribute('href')),
        brandHref: document.querySelector('.brand')?.getAttribute('href'),
        thumbs: [...document.images].map((i) => ({ src: i.getAttribute('src'), nw: i.naturalWidth })),
        alts: [...document.images].map((i) => i.getAttribute('alt')),
        consoleLoading: document.readyState,
      };
    })()`);
    out.checks.initial = {
      title: base.title,
      defaultTheme: base.theme,
      cardCount: base.cards,
      allCardsIndexHtml: base.hrefs.length === GAME_COUNT && base.hrefs.every((h) => CARD_RE[lang].test(h)),
      brandHref: base.brandHref,
      thumbsLoaded: base.thumbs.filter((t) => t.nw > 0).length,
      thumbsTotal: base.thumbs.length,
      altsAllSet: base.alts.every((a) => a && a.trim()),
      hrefs: base.hrefs,
    };
    out.checks.consoleErrors = session.consoleErrors.slice();
    out.checks.pageErrors = session.pageErrors.slice();
    out.checks.shotRetro = await session.screenshot(`${outDir}/${tag}-retro-1440.png`);
    // смена темы клавишей G
    await session.pressKey('g');
    await sleep(1000);
    out.checks.afterG = await session.evaluate(`(() => ({
      theme: document.documentElement.getAttribute('data-theme'),
      pressed: document.querySelector('#theme-toggle')?.getAttribute('aria-pressed'),
      firstThumb: document.querySelector('#game-grid .card-img')?.getAttribute('src'),
      thumbsLoaded: [...document.images].filter((i) => i.naturalWidth > 0).length,
    }))()`);
    out.checks.shotModern = await session.screenshot(`${outDir}/${tag}-modern-1440.png`);

    // клик по первой карточке → должна открыться игра, а не листинг
    const firstHref = await session.evaluate(`document.querySelector('#game-grid a[href]')?.getAttribute('href') || ''`);
    await session.evaluate(`document.querySelector('#game-grid a[href]')?.click()`);
    await sleep(2000);
    out.checks.cardClick = {
      href: firstHref,
      ...(await session.evaluate(`({
        url: location.href,
        title: document.title,
        isDirectoryListing: Boolean(document.querySelector('title') && /Index of|Directory listing/i.test(document.title + ' ' + document.body.innerText)),
        canvas: Boolean(document.querySelector('canvas')),
      })`)),
    };
    out.checks.cardClick.urlEndsWithIndexHtml = (lang === 'en' ? /\/index\.html\?lang=en$/ : /\/index\.html$/).test(out.checks.cardClick.url);
    out.checks.shotCardClick = await session.screenshot(`${outDir}/${tag}-card-click.png`);

    // из игры обратно: «← Каталог» ведёт на index.html каталога того же языка (не на листинг папки)
    const back = await session.evaluate(`(() => { const a = document.querySelector('a[data-catalog-back]'); return a ? { href: a.getAttribute('href'), text: a.textContent.trim() } : null; })()`);
    const wantBack = lang === 'en' ? '../en/index.html' : '../index.html';
    out.checks.back = { ...(back || {}), found: Boolean(back), hrefOk: Boolean(back) && back.href === wantBack, want: wantBack,
      labelOk: Boolean(back) && (lang === 'en' ? /catalog/i.test(back.text) && !/[А-Яа-яЁё]/.test(back.text) : /каталог/i.test(back.text)) };
    if (back) {
      await session.evaluate(`document.querySelector('a[data-catalog-back]').click()`);
      await sleep(1800);
      Object.assign(out.checks.back, await session.evaluate(`({
        url: location.href,
        isDirectoryListing: /Index of|Directory listing/i.test(document.title + ' ' + document.body.innerText.slice(0, 400)),
        cards: document.querySelectorAll('#game-grid a[href]').length,
        lang: document.documentElement.lang,
      })`));
      out.checks.back.returnedOk = out.checks.back.url === fileUrl && !out.checks.back.isDirectoryListing && out.checks.back.cards === GAME_COUNT;
    }
  }
  const c = out.checks;
  out.fails = [
    !c.initial.allCardsIndexHtml && `карточки: ${c.initial.cardCount} из ${GAME_COUNT} со ссылкой на index.html`,
    c.initial.thumbsLoaded < GAME_COUNT && `превью загружено ${c.initial.thumbsLoaded}`,
    !c.initial.altsAllSet && 'не у всех превью alt',
    (c.consoleErrors.length || c.pageErrors.length) && `ошибки страницы: ${[...c.consoleErrors, ...c.pageErrors].slice(0, 3).join(' | ')}`,
    c.afterG.theme === c.initial.defaultTheme && 'G не переключает тему',
    !(c.cardClick.canvas && !c.cardClick.isDirectoryListing && c.cardClick.urlEndsWithIndexHtml) && `клик по карточке: ${c.cardClick.url}`,
    !(c.back.found && c.back.hrefOk && c.back.labelOk && c.back.returnedOk) && `«← Каталог» из игры: href=${c.back.href} (нужно ${c.back.want}), подпись «${c.back.text}», вернулись на ${c.back.url}`,
  ].filter(Boolean);
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2), { catalog: '', outDir: QA_SHOTS });
  const pages = args.catalog ? [resolve(String(args.catalog))] : [resolve(ROOT, 'index.html'), resolve(ROOT, 'en/index.html')];
  const session = await launch({ width: 1440, height: 900 });
  const results = [];
  try {
    for (const p of pages) results.push(await checkPage(session, p, args.outDir));
  } finally {
    await session.close();
  }
  console.log(JSON.stringify(results, (k, v) => (k === 'hrefs' ? `${v.length} ссылок, первая: ${v[0]}` : v), 2));
  console.log('\n=== FILE:// ===');
  for (const r of results) console.log(`${r.fails.length ? 'FAIL' : 'OK  '} ${r.lang} ${r.fileUrl}${r.fails.length ? '\n  - ' + r.fails.join('\n  - ') : ''}`);
  if (results.some((r) => r.fails.length)) process.exitCode = 1;
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });

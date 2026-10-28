#!/usr/bin/env node
/**
 * audit-games.mjs — приёмка всех игр: HTTP 200, title, canvas, консоль/страницы,
 * внешние запросы (офлайн), скриншоты в reports/qa-shots/.
 *
 * Пример:
 *   node tools/qa/audit-games.mjs --base http://127.0.0.1:8098 \
 *     --out-dir reports/qa-shots --json reports/qa-shots/games-audit.json
 *
 * Скрипт ничего не меняет в играх; только читает страницы и снимает скриншоты.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { launch, parseArgs, httpCheck } from './lib.mjs';

const DEFAULT_SLUGS = [
  'boulder-dash', 'contra', 'digger', 'double-dragon-battletoads', 'exolon',
  'lode-runner', 'lost-vikings', 'lost-vikings-2', 'river-raid', 'silkworm',
  'the-last-mission',
];

// Ошибки/предупреждения, которые считаем заведомо безобидными для ретро-игр.
const BENIGN_CONSOLE = [
  /AudioContext was not allowed to start/i,
  /The AudioContext was not allowed to start/i,
  /play\(\) failed because the user didn't interact/i,
  /favicon\.ico/i,
];

function isBenign(text) {
  return BENIGN_CONSOLE.some((re) => re.test(text));
}

function externalHosts(requests, allowedHosts = []) {
  const hosts = new Map();
  for (const req of requests.values()) {
    let url;
    try {
      url = new URL(req.url);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(url.protocol)) continue;
    const host = url.hostname;
    const allowed = ['127.0.0.1', 'localhost', '[::1]', '::1', ...allowedHosts];
    if (allowed.includes(host)) continue;
    if (!hosts.has(host)) hosts.set(host, []);
    hosts.get(host).push(req.url);
  }
  return [...hosts.entries()].map(([host, urls]) => ({ host, urls: [...new Set(urls)] }));
}

async function inspectPage(session) {
  return session.evaluate(`(() => {
    const canvas = document.querySelector('canvas');
    const canvasInfo = canvas ? {
      id: canvas.id || '',
      width: canvas.width,
      height: canvas.height,
      clientWidth: Math.round(canvas.getBoundingClientRect().width),
      clientHeight: Math.round(canvas.getBoundingClientRect().height),
      ariaLabel: canvas.getAttribute('aria-label') || '',
      visible: canvas.getBoundingClientRect().width > 0 && canvas.getBoundingClientRect().height > 0,
    } : null;
    // насколько холст «не пустой»: пробуем 2d-контекст. WebGL не трогаем.
    let canvasPaint = 'no-canvas';
    if (canvas) {
      try {
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          canvasPaint = 'non-2d';
        } else {
          const w = canvas.width, h = canvas.height;
          const data = ctx.getImageData(0, 0, w, h).data;
          const colors = new Set();
          for (let y = 0; y < h; y += Math.max(1, Math.floor(h / 40))) {
            for (let x = 0; x < w; x += Math.max(1, Math.floor(w / 40))) {
              const i = (y * w + x) * 4;
              colors.add(data[i] + ',' + data[i + 1] + ',' + data[i + 2] + ',' + data[i + 3]);
              if (colors.size > 40) break;
            }
            if (colors.size > 40) break;
          }
          canvasPaint = colors.size === 1 ? 'blank(single-color)' : 'painted(' + colors.size + '+)';
        }
      } catch (e) {
        canvasPaint = 'error:' + String(e && e.message || e);
      }
    }
    const err = document.querySelector('#err, #error, .error-overlay, [data-error]');
    const errVisible = err ? (getComputedStyle(err).display !== 'none' && (err.textContent || '').trim().length > 0) : false;
    const bodyText = (document.body?.innerText || '').trim();
    return {
      title: document.title || '',
      lang: document.documentElement.lang || '',
      themeAttr: {
        bodyClass: document.body?.className || '',
        dataGfx: document.body?.getAttribute('data-gfx') || document.body?.getAttribute('data-theme') || document.documentElement.getAttribute('data-gfx') || '',
      },
      canvas: canvasInfo,
      canvasPaint,
      errorOverlayVisible: errVisible,
      errorOverlayText: errVisible ? (err.textContent || '').trim().slice(0, 200) : '',
      bodyTextLen: bodyText.length,
      bodyTextHead: bodyText.slice(0, 160),
      scripts: document.scripts.length,
      stylesheets: document.styleSheets.length,
      viewport: { scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth, scrollHeight: document.documentElement.scrollHeight, innerHeight: window.innerHeight },
    };
  })()`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2), {
    base: 'http://127.0.0.1:8098',
    outDir: 'reports/qa-shots',
    json: 'reports/qa-shots/games-audit.json',
    wait: 2200,
  });
  if (args.help) {
    console.log('usage: node tools/qa/audit-games.mjs [--base URL] [--out-dir DIR] [--json FILE] [--slug a,b]');
    return;
  }
  const slugs = args.slug ? String(args.slug).split(',').map((s) => s.trim()).filter(Boolean) : DEFAULT_SLUGS;
  mkdirSync(args.outDir, { recursive: true });

  // HTTP-проверка всех URL без браузера. Последовательно: python http.server
  // рвёт часть параллельных соединений (ECONNRESET), это не дефект сайта.
  const http = {};
  for (const slug of slugs) {
    http[slug] = await httpCheck(`${args.base}/${slug}/`);
  }

  const session = await launch({ width: 1440, height: 900 });
  const results = [];
  try {
    for (const slug of slugs) {
      const record = { slug, http: http[slug], desktop: null, mobile: null, errors: [] };
      // ── десктоп 1440×900, ретро-режим по умолчанию ──
      await session.setViewport({ width: 1440, height: 900, mobile: false });
      try {
        const nav = await session.goto(`${args.base}/${slug}/`, { wait: args.wait });
        const info = await inspectPage(session);
        const shot = await session.screenshot(`${args.outDir}/${slug}-retro-1440.png`);
        const external = externalHosts(session.requests, [new URL(args.base).hostname]);
        const badAll = session.responses.filter((r) => r.status >= 400).map((r) => ({ url: r.url, status: r.status, type: r.type }));
        const favicon404 = badAll.filter((r) => /favicon/i.test(r.url));
        const bad = badAll.filter((r) => !/favicon/i.test(r.url));
        const failed = session.failedRequests.filter((f) => !/favicon/i.test(f.url));
        const consoleErrors = session.consoleErrors;
        const blockingConsole = consoleErrors.filter((e) => !isBenign(e));
        record.desktop = {
          url: `${args.base}/${slug}/`,
          navElapsedMs: nav.elapsedMs,
          ...info,
          consoleErrors,
          blockingConsoleErrors: blockingConsole,
          consoleWarnings: session.consoleWarnings,
          pageErrors: session.pageErrors,
          logErrors: session.logErrors,
          logErrorsBlocking: session.logErrors.filter((e) => !/favicon/i.test(e)),
          badResponses: bad,
          favicon404,
          failedRequests: failed,
          externalHosts: external,
          requestCount: session.requests.size,
          screenshot: shot,
        };
        // Если 2d-холст пуст — возможно, игра рисует только после старта.
        // Пробуем Enter и фиксируем кадр: это диагностика, не критерий приёмки.
        if (!String(info.canvasPaint).startsWith('painted') && info.canvasPaint !== 'non-2d') {
          try {
            await session.pressKey('Enter');
            await new Promise((r) => setTimeout(r, 1500));
            const started = await inspectPage(session);
            record.desktop.canvasPaintAfterStart = started.canvasPaint;
            record.desktop.startedScreenshot = await session.screenshot(`${args.outDir}/${slug}-started-1440.png`);
            record.desktop.blockingConsoleErrorsAfterStart = session.consoleErrors.filter((e) => !isBenign(e));
            record.desktop.pageErrorsAfterStart = [...session.pageErrors];
          } catch (error) {
            record.desktop.startAttemptError = String(error?.message || error);
          }
        }
      } catch (error) {
        record.desktop = { fatal: String(error?.message || error) };
      }

      // ── мобильный 390×844: горизонтальный скролл/высота, без второго ожидания анимаций ──
      await session.setViewport({ width: 390, height: 844, mobile: true });
      try {
        const nav = await session.goto(`${args.base}/${slug}/`, { wait: 1200 });
        const info = await inspectPage(session);
        const shot = await session.screenshot(`${args.outDir}/${slug}-mobile-390.png`);
        record.mobile = {
          navElapsedMs: nav.elapsedMs,
          viewport: info.viewport,
          canvas: info.canvas,
          canvasPaint: info.canvasPaint,
          horizontalScroll: info.viewport.scrollWidth > info.viewport.innerWidth + 1,
          consoleErrors: session.consoleErrors.filter((e) => !isBenign(e)),
          pageErrors: session.pageErrors,
          screenshot: shot,
        };
      } catch (error) {
        record.mobile = { fatal: String(error?.message || error) };
      }

      // сводная оценка
      const d = record.desktop;
      record.verdict = {
        httpOk: http[slug]?.status === 200,
        titleOk: Boolean(d?.title && d.title.trim()),
        canvasOk: Boolean(d?.canvas && d.canvas.visible && d.canvas.width > 0 && d.canvas.height > 0),
        consoleOk: Boolean(d && d.blockingConsoleErrors.length === 0),
        pageErrorsOk: Boolean(d && d.pageErrors.length === 0),
        externalOk: Boolean(d && d.externalHosts.length === 0),
        badResponsesOk: Boolean(d && d.badResponses.length === 0),
        mobileNoHScroll: record.mobile?.horizontalScroll === false,
        noFatal: !d?.fatal,
      };
      results.push(record);
      const v = record.verdict;
      const flags = Object.entries(v).filter(([, ok]) => ok === false).map(([k]) => k);
      console.log(`${slug}: HTTP=${http[slug]?.status} title=${JSON.stringify(d?.title || '')} canvas=${v.canvasOk ? 'ok' : 'FAIL'} paint=${d?.canvasPaint} errors=${d?.blockingConsoleErrors?.length || 0}/${d?.pageErrors?.length || 0} external=${d?.externalHosts?.length || 0}${flags.length ? ' FLAGS=' + flags.join(',') : ''}`);
    }
  } finally {
    await session.close();
  }

  const summary = {
    when: new Date().toISOString(),
    base: args.base,
    viewport: { desktop: '1440x900', mobile: '390x844' },
    total: results.length,
    pass: results.filter((r) => Object.values(r.verdict || {}).every((x) => x !== false)).length,
    results,
  };
  mkdirSync(args.outDir, { recursive: true });
  writeFileSync(args.json, JSON.stringify(summary, null, 2));
  console.log(`\nJSON: ${args.json}`);
  console.log(`PASS ${summary.pass}/${summary.total} (строгая оценка по всем флагам)`);
}

main().catch((error) => {
  console.error('FATAL', error);
  process.exit(1);
});

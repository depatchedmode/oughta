// Screenshots of live pages for a spec (ctx.screenshot), with rings and captions from annotate.mjs.
//
// Unlike slides, these pages load from the network: the spec asked for the URL, and a spec is code
// that already runs commands. They use their own browser, which is never used to render slides.
import { existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import path from 'node:path';
import { annotate } from '../annotate.mjs';
import { chromium } from './browser.mjs';

/**
 * A screenshotter for an output folder. Shots go to <out>/.shots-new while the spec runs, and
 * commit() moves them to <out>/shots when the build replaces its output, so a build that stops
 * at a check leaves the last output's shots alone. Returns { shoot, staged, close, commit }.
 *   shoot(url, { name, viewport = { width: 1600, height: 900 }, waitFor, marks, fullPage })
 *     → the PNG's path in <out>/shots
 *     waitFor: a selector to wait for before shooting.
 *     marks: [{ target, caption, position, color }]: target is a Playwright selector
 *            ('text=Payroll (paused)', '#total'); each gets a ring and a 2–5 word caption. The
 *            page scrolls to the first; every mark must then be in the shot.
 */
export function screenshotter(out) {
  const staging = path.join(out, '.shots-new');
  const final = path.join(out, 'shots');
  let browser;
  let count = 0;
  return {
    async shoot(url, { name, viewport = { width: 1600, height: 900 }, waitFor, marks = [], fullPage = false } = {}) {
      if (!count) {
        rmSync(staging, { recursive: true, force: true });
        mkdirSync(staging, { recursive: true });
      }
      count++;
      browser ??= await chromium().launch();
      const page = await browser.newPage({ viewport });
      const where = `screenshot ${url}`;
      try {
        await page.goto(url, { waitUntil: 'networkidle' });
        if (waitFor) await page.waitForSelector(waitFor);
        const targets = marks.map((m) => page.locator(m.target).first());
        if (targets.length && !fullPage) await targets[0].scrollIntoViewIfNeeded().catch(() => {});
        for (const [i, { target, caption = '', ...options }] of marks.entries()) {
          const box = await targets[i].boundingBox();
          if (!box) throw new Error(`${where}: nothing on the page matches "${target}"`);
          const inView = box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width && box.y + box.height <= viewport.height;
          if (!fullPage && !inView) throw new Error(`${where}: "${target}" is outside the shot; mark things that fit in one view, or use fullPage: true`);
          await annotate(page, targets[i], caption, { ...options, area: fullPage ? 'page' : 'viewport' });
        }
        // annotate fades its rings in over 200 ms.
        if (marks.length) await page.waitForTimeout(300);
        const file = `${String(name ?? count).replace(/[^\w-]+/g, '_')}.png`;
        await page.screenshot({ path: path.join(staging, file), fullPage });
        return path.join(final, file);
      } finally {
        await page.close();
      }
    },
    /**
     * Where a path in <out>/shots is until commit(): this run's staging copy (which may not exist,
     * if the run took no such shot). null for a path outside <out>/shots.
     */
    staged(file) {
      const rel = path.relative(final, file);
      return rel && !rel.startsWith('..') && !path.isAbsolute(rel) ? path.join(staging, rel) : null;
    },
    async close() {
      await browser?.close();
    },
    /** Replace <out>/shots with this run's shots (or remove it, if the spec took none). */
    commit() {
      rmSync(final, { recursive: true, force: true });
      if (count && existsSync(staging)) renameSync(staging, final);
      else rmSync(staging, { recursive: true, force: true });
    },
  };
}

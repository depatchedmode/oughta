// The browser that renders slides: Playwright's Chromium from <home>/node, offline.
//
// Slides render with no network: a page may load file: and data: URLs only. Themes and repo
// config can come from the repo being narrated, which may be someone else's branch, and a
// stylesheet that fetches a font or image from a server could tell that server what's on the
// slides (captured output included). Everything a slide shows must be on disk.
import { createRequire } from 'node:module';
import path from 'node:path';
import { NODE_DIR, SETUP } from './paths.mjs';

export function chromium() {
  try {
    return createRequire(path.join(NODE_DIR, 'package.json'))('playwright').chromium;
  } catch {
    throw Object.assign(new Error(`Playwright isn't installed. Run: ${SETUP}`), { exitCode: 1 });
  }
}

/** Launch the browser. Returns { browser, newPage(options) }; every page it makes is offline. */
export async function launch() {
  const browser = await chromium().launch();
  return {
    browser,
    async newPage(options = {}) {
      const context = await browser.newContext({ ...options, offline: true });
      await context.route(/^(?!file:|data:)/, (route) => route.abort());
      return context.newPage();
    },
  };
}

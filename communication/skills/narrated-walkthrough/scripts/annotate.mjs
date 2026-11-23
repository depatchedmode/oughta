// Adapted from ux-auto-improve in developer-skill-pack
// (https://github.com/dennisonbertram/developer-skill-pack), used under the MIT License:
//
// Copyright (c) 2026 Dennison Bertram
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

// Visual annotations for walkthrough recordings (Playwright).
// Draws a highlight ring around the element the narration is about, with a short caption,
// so viewers can see exactly what is being discussed. The overlay is plain DOM injected
// into the page, so it is captured by recordVideo and by screenshots. Specs use it through
// screenshot(url, { marks }) (lib/screenshot.mjs); direct use:
//
//   import { annotate, clearAnnotations } from "./annotate.mjs";
//   await annotate(page, page.getByText("Payroll (paused)").locator(".."), "No warning");
//   await page.waitForTimeout(2500);   // hold so it can be read
//   await clearAnnotations(page);
//
// Options: { color: "#f43f5e", position: "top" | "bottom" | "left" | "right", pad: 8,
//            area: "viewport" | "page" }   where the caption must stay: the visible part of the
//            page (a screenshot) or the whole page (a fullPage screenshot).
// The overlay is placed in page coordinates, so it stays on its target however the page scrolls.

const ID = "walkthrough-annotations";

export async function annotate(page, locator, caption = "", options = {}) {
  const box = await locator.first().boundingBox();
  if (!box) return false;
  await page.evaluate(
    ({ box: viewBox, caption, color, position, pad, id, area }) => {
      const doc = document.documentElement;
      const box = { ...viewBox, x: viewBox.x + scrollX, y: viewBox.y + scrollY };
      const [minX, maxX, minY, maxY] = area === "page"
        ? [0, doc.scrollWidth, 0, doc.scrollHeight]
        : [scrollX, scrollX + innerWidth, scrollY, scrollY + innerHeight];
      let layer = document.getElementById(id);
      if (!layer) {
        layer = document.createElement("div");
        layer.id = id;
        Object.assign(layer.style, {
          position: "absolute", left: "0", top: "0", width: "0", height: "0", pointerEvents: "none", zIndex: "2147483647",
        });
        document.body.appendChild(layer);
      }
      // The layer's own origin, in case the body is positioned or has a margin.
      const origin = layer.getBoundingClientRect();
      const ox = origin.left + scrollX;
      const oy = origin.top + scrollY;
      // One dimming layer for the whole page, with a hole for every mark, so several marks on one
      // page all stay bright (a shadow per ring would dim the other targets).
      const NS = "http://www.w3.org/2000/svg";
      let dim = layer.querySelector(":scope > svg.dim");
      if (!dim) {
        dim = document.createElementNS(NS, "svg");
        dim.setAttribute("class", "dim");
        dim.innerHTML = `<defs><mask id="${id}-holes" maskUnits="userSpaceOnUse"><rect class="all" fill="#fff"/></mask></defs><rect class="all" fill="rgba(0,0,0,0.35)" mask="url(#${id}-holes)"/>`;
        Object.assign(dim.style, { position: "absolute", left: `${-ox}px`, top: `${-oy}px`, overflow: "visible", transition: "opacity 200ms", opacity: "0" });
        layer.prepend(dim);
        requestAnimationFrame(() => (dim.style.opacity = "1"));
      }
      const w = Math.max(doc.scrollWidth, scrollX + innerWidth);
      const h = Math.max(doc.scrollHeight, scrollY + innerHeight);
      dim.setAttribute("width", w);
      dim.setAttribute("height", h);
      for (const r of dim.querySelectorAll("rect.all")) {
        r.setAttribute("width", w);
        r.setAttribute("height", h);
      }
      const hole = document.createElementNS(NS, "rect");
      for (const [k, v] of Object.entries({ x: box.x - pad, y: box.y - pad, width: box.width + pad * 2, height: box.height + pad * 2, rx: 12, fill: "#000" })) hole.setAttribute(k, v);
      dim.querySelector("mask").appendChild(hole);
      const ring = document.createElement("div");
      ring.className = "ring";
      Object.assign(ring.style, {
        position: "absolute", boxSizing: "border-box",
        left: `${box.x - ox - pad}px`, top: `${box.y - oy - pad}px`,
        width: `${box.width + pad * 2}px`, height: `${box.height + pad * 2}px`,
        border: `4px solid ${color}`, borderRadius: "12px",
        transition: "opacity 200ms", opacity: "0",
      });
      layer.appendChild(ring);
      if (caption) {
        const tag = document.createElement("div");
        tag.className = "caption";
        tag.textContent = caption;
        Object.assign(tag.style, {
          position: "absolute", background: color, color: "#fff",
          font: "600 22px/1.25 -apple-system, system-ui, sans-serif",
          padding: "8px 14px", borderRadius: "10px", width: "max-content", maxWidth: "420px",
          boxShadow: "0 6px 20px rgba(0,0,0,0.3)", opacity: "0", transition: "opacity 200ms",
        });
        layer.appendChild(tag);
        const r = tag.getBoundingClientRect();
        const gap = pad + 12;
        const spots = {
          top: [box.x, box.y - gap - r.height],
          bottom: [box.x, box.y + box.height + gap],
          // Beside the target, centred on it.
          left: [box.x - gap - r.width, box.y + (box.height - r.height) / 2],
          right: [box.x + box.width + gap, box.y + (box.height - r.height) / 2],
        };
        let [x, y] = spots[position] ?? spots.top;
        if (y < minY + 8) [x, y] = spots.bottom; // no room above: go below
        x = Math.max(minX + 8, Math.min(x, maxX - r.width - 8));
        y = Math.max(minY + 8, Math.min(y, maxY - r.height - 8));
        Object.assign(tag.style, { left: `${x - ox}px`, top: `${y - oy}px` });
        requestAnimationFrame(() => (tag.style.opacity = "1"));
      }
      requestAnimationFrame(() => (ring.style.opacity = "1"));
    },
    {
      box, caption, id: ID,
      color: options.color ?? "#f43f5e",
      position: options.position ?? "top",
      pad: options.pad ?? 8,
      area: options.area ?? "viewport",
    },
  );
  return true;
}

export async function clearAnnotations(page) {
  await page.evaluate((id) => document.getElementById(id)?.remove(), ID);
}

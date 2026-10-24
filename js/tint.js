// Picks a soft background tint for a section or trip from its cover photo.
// Elements with data-tint="#hex" (a colour chosen in the admin panel) use that colour;
// elements with data-tint-src="<image>" get the photo's main colour.
// The result is set as --th (hue) and --ts (saturation) for the CSS to use.
// Results are remembered per photo, so a changed cover simply gets a new colour.

import { imageUrl } from "./media.js";

const memory = new Map();

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h / 6, s, l];
}

function hexToHsl(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return rgbToHsl((n >> 16) & 255, (n >> 8) & 255, n & 255);
}

// Finds the most prominent colourful hue (ignoring greys, near-black and near-white).
function dominant(pixels) {
  const BINS = 24;
  const weight = new Array(BINS).fill(0);
  const sat = new Array(BINS).fill(0);
  const hx = new Array(BINS).fill(0);
  const hy = new Array(BINS).fill(0);
  let total = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue;
    const [h, s, l] = rgbToHsl(pixels[i], pixels[i + 1], pixels[i + 2]);
    const w = s * (1 - Math.abs(l - 0.5) * 2);
    total += 1;
    if (w < 0.08) continue;
    const bin = Math.min(BINS - 1, Math.floor(h * BINS));
    weight[bin] += w;
    sat[bin] += s * w;
    hx[bin] += Math.cos(h * 2 * Math.PI) * w;
    hy[bin] += Math.sin(h * 2 * Math.PI) * w;
  }
  let best = 0;
  for (let b = 1; b < BINS; b++) if (weight[b] > weight[best]) best = b;
  if (!total || weight[best] / total < 0.02) return [0.42, 0.05]; // mostly grey photo → neutral
  let h = Math.atan2(hy[best], hx[best]) / (2 * Math.PI);
  if (h < 0) h += 1;
  return [h, sat[best] / weight[best]];
}

function fromImage(src) {
  const key = `tint:${src}`;
  if (memory.has(key)) return memory.get(key);
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      const v = Promise.resolve(saved.split(",").map(Number));
      memory.set(key, v);
      return v;
    }
  } catch { /* storage unavailable */ }

  const promise = new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => {
      try {
        const size = 32;
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = size;
        const cx = canvas.getContext("2d", { willReadFrequently: true });
        cx.drawImage(img, 0, 0, size, size);
        const hs = dominant(cx.getImageData(0, 0, size, size).data);
        try { localStorage.setItem(key, hs.map((n) => n.toFixed(3)).join(",")); } catch { /* ignore */ }
        resolve(hs);
      } catch {
        resolve(null); // image host doesn't allow reading pixels
      }
    };
    img.onerror = () => resolve(null);
    img.src = imageUrl(src, 64);
  });
  memory.set(key, promise);
  return promise;
}

function clear(el) {
  el.style.removeProperty("--th");
  el.style.removeProperty("--ts");
  el.classList.remove("has-tint");
}

function set(el, [h, s]) {
  el.style.setProperty("--th", String(Math.round(h * 360)));
  el.style.setProperty("--ts", `${Math.round(Math.min(Math.max(s, 0.04), 0.62) * 100)}%`);
  el.classList.add("has-tint");
}

// Applies tints to `root` (if it has tint data) and every tinted element inside it.
export function applyTints(root) {
  clear(root);
  const els = [root, ...root.querySelectorAll("[data-tint], [data-tint-src]")];
  for (const el of els) {
    const custom = el.dataset.tint;
    const src = el.dataset.tintSrc;
    if (!custom && !src) {
      if (el === root) clear(el);
      continue;
    }
    if (custom) {
      const hsl = hexToHsl(custom);
      if (hsl) { set(el, hsl); continue; }
    }
    if (!src) { clear(el); continue; }
    const token = `${custom || ""}|${src}`;
    el.dataset.tintToken = token;
    fromImage(src).then((hs) => {
      // Skip if the page changed while the photo was loading.
      if (!hs || !el.isConnected || el.dataset.tintToken !== token) return;
      set(el, hs);
    });
  }
}

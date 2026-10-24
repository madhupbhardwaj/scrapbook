// Image and video helpers: Cloudinary URLs and YouTube IDs.

import { CONFIG } from "./config.js";

const CLD_HOST = "res.cloudinary.com";
const isUrl = (s) => /^https?:\/\//i.test(s);
const isCloudinary = (s) => !!s && (!isUrl(s) || s.includes(CLD_HOST));

// Returns a URL for an image at roughly `width` pixels.
// - Cloudinary public ID ("scrapbook/himachal/bus") → optimised Cloudinary URL
// - Cloudinary URL → same URL with resizing + auto format/quality added
// - Any other URL → returned unchanged
export function imageUrl(src, width = 1200) {
  if (!src) return "";
  const t = `f_auto,q_auto,c_limit,w_${width}`;
  if (isUrl(src)) {
    return src.includes(CLD_HOST) && src.includes("/image/upload/")
      ? src.replace("/image/upload/", `/image/upload/${t}/`)
      : src;
  }
  return `https://${CLD_HOST}/${CONFIG.cloudinaryCloudName}/image/upload/${t}/${src.replace(/^\/+/, "")}`;
}

// Responsive srcset for Cloudinary images (empty for other hosts).
export function imageSrcset(src, widths = [480, 800, 1200, 1800, 2400]) {
  if (!isCloudinary(src)) return "";
  return widths.map((w) => `${imageUrl(src, w)} ${w}w`).join(", ");
}

// Video stored on Cloudinary (public ID or full URL).
export function cloudinaryVideoUrl(src) {
  if (!src) return "";
  if (isUrl(src)) return src;
  return `https://${CLD_HOST}/${CONFIG.cloudinaryCloudName}/video/upload/q_auto/${src.replace(/^\/+/, "")}`;
}

// Accepts a bare ID or any common YouTube link (watch, youtu.be, shorts, embed, live).
export function youtubeId(value = "") {
  const v = String(value).trim();
  if (/^[\w-]{11}$/.test(v)) return v;
  try {
    const u = new URL(v);
    if (u.hostname.endsWith("youtu.be")) return u.pathname.slice(1, 12) || null;
    const q = u.searchParams.get("v");
    if (q) return q;
    const m = u.pathname.match(/\/(?:embed|shorts|live)\/([\w-]{11})/);
    if (m) return m[1];
  } catch {
    /* not a URL */
  }
  return null;
}

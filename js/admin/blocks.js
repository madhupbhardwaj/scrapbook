// The entry body builder: a list of blocks (text, photo, gallery, video, quote)
// that can be added, edited, reordered and removed.

import { youtubeId } from "../media.js";
import { imageUrl } from "../media.js";
import { h, iconButton, field, confirmDialog, toast } from "./ui.js";
import { imagePicker, multiUploader, uploadVideo, progressBar } from "./upload.js";

const TYPES = {
  text: { label: "Text", make: () => ({ type: "text", body: "" }) },
  image: { label: "Photo", make: () => ({ type: "image", src: "", caption: "", wide: false }) },
  gallery: { label: "Gallery", make: () => ({ type: "gallery", caption: "", images: [] }) },
  video: { label: "Video", make: () => ({ type: "video", youtube: "", caption: "" }) },
  quote: { label: "Quote", make: () => ({ type: "quote", text: "", cite: "" }) },
};

const hasContent = (b) =>
  !!(b.body || b.src || b.text || b.youtube || b.cloudinary || b.caption || b.images?.length);

function autosize(textarea) {
  const fit = () => {
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight + 2}px`;
  };
  textarea.addEventListener("input", fit);
  requestAnimationFrame(fit);
  return textarea;
}

/**
 * blocks: the array to edit (mutated in place).
 * onChange: called after any change, so the editor can mark itself unsaved.
 */
export function blockEditor(blocks, onChange) {
  const list = h("ol", { class: "blocks" });
  const root = h("div", { class: "block-editor" },
    list,
    h("div", { class: "add-block" },
      h("span", { class: "add-block-label" }, "Add"),
      Object.entries(TYPES).map(([type, t]) =>
        h("button", { type: "button", class: "btn btn-small", onClick: () => add(type) }, t.label)),
    ),
  );

  const changed = () => onChange?.();

  function add(type) {
    blocks.push(TYPES[type].make());
    changed();
    render();
    const cards = list.querySelectorAll(".block");
    const last = cards[cards.length - 1];
    last?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    last?.querySelector("textarea, input:not([type=checkbox])")?.focus({ preventScroll: true });
  }

  function move(i, delta) {
    const j = i + delta;
    if (j < 0 || j >= blocks.length) return;
    [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
    changed();
    render();
    list.querySelectorAll(".block")[j]?.querySelector(`[aria-label="${delta < 0 ? "Move block up" : "Move block down"}"]`)?.focus();
  }

  async function remove(i) {
    if (hasContent(blocks[i])) {
      const ok = await confirmDialog({ title: `Remove this ${TYPES[blocks[i].type]?.label.toLowerCase() || "block"}?`, message: "Its content will be removed from the entry when you save.", confirmLabel: "Remove", danger: true });
      if (!ok) return;
    }
    blocks.splice(i, 1);
    changed();
    render();
  }

  function render() {
    list.replaceChildren(...blocks.map((b, i) =>
      h("li", { class: "block", dataset: { type: b.type } },
        h("div", { class: "block-head" },
          h("span", { class: "block-type" }, TYPES[b.type]?.label || b.type),
          h("div", { class: "block-tools" },
            iconButton("up", "Move block up", () => move(i, -1), { disabled: i === 0 }),
            iconButton("down", "Move block down", () => move(i, 1), { disabled: i === blocks.length - 1 }),
            iconButton("remove", "Remove block", () => remove(i)),
          ),
        ),
        h("div", { class: "block-body" }, body(b)),
      )));
    if (!blocks.length) {
      list.append(h("li", { class: "blocks-empty" }, "This entry has no content yet. Add text, photos or a video below."));
    }
  }

  function input(b, key, attrs = {}) {
    const el = h(attrs.multiline ? "textarea" : "input", {
      class: "input", value: b[key] || "", placeholder: attrs.placeholder || "", rows: attrs.rows,
      type: attrs.multiline ? null : "text",
    });
    el.addEventListener("input", () => { b[key] = el.value; changed(); });
    return attrs.multiline ? autosize(el) : el;
  }

  function body(b) {
    switch (b.type) {
      case "text": {
        const area = input(b, "body", { multiline: true, rows: 6, placeholder: "Write here…" });
        area.setAttribute("aria-label", "Text");
        return [textToolbar(area), area, h("p", { class: "hint" }, "Select words, then tap a button. Leave an empty line for a new paragraph.")];
      }

      case "image": {
        const wide = h("input", { type: "checkbox", checked: !!b.wide });
        wide.addEventListener("change", () => { b.wide = wide.checked; changed(); });
        return [
          imagePicker(b.src, (id) => { b.src = id; changed(); }),
          field("Caption", input(b, "caption", { placeholder: "Optional" })),
          h("label", { class: "check" }, wide, " Show wider than the text"),
        ];
      }

      case "gallery":
        return galleryBody(b);

      case "video":
        return videoBody(b);

      case "quote":
        return [
          field("Quote", input(b, "text", { multiline: true, rows: 2 })),
          field("Said by / source", input(b, "cite", { placeholder: "Optional" })),
        ];

      default:
        return h("p", { class: "muted" }, "This block type can't be edited here.");
    }
  }

  function galleryBody(b) {
    b.images ||= [];
    const grid = h("ul", { class: "gallery-edit" });

    const draw = () => {
      grid.replaceChildren(...b.images.map((im, i) => {
        const cap = h("input", { class: "input input-small", value: im.caption || "", placeholder: "Caption", "aria-label": `Caption for photo ${i + 1}` });
        cap.addEventListener("input", () => { im.caption = cap.value; changed(); });
        return h("li", { class: "g-item" },
          h("img", { src: imageUrl(im.src, 400), alt: im.caption || `Photo ${i + 1}`, loading: "lazy" }),
          cap,
          h("div", { class: "g-tools" },
            iconButton("left", "Move photo earlier", () => { if (i > 0) { [b.images[i - 1], b.images[i]] = [b.images[i], b.images[i - 1]]; changed(); draw(); } }, { disabled: i === 0 }),
            iconButton("right", "Move photo later", () => { if (i < b.images.length - 1) { [b.images[i + 1], b.images[i]] = [b.images[i], b.images[i + 1]]; changed(); draw(); } }, { disabled: i === b.images.length - 1 }),
            iconButton("remove", "Remove photo", () => { b.images.splice(i, 1); changed(); draw(); }),
          ),
        );
      }));
    };
    draw();

    return [
      grid,
      multiUploader((id) => { b.images.push({ src: id, caption: "" }); changed(); draw(); }),
      field("Gallery caption", input(b, "caption", { placeholder: "Optional" })),
    ];
  }

  function videoBody(b) {
    const preview = h("div", { class: "video-preview" });
    const link = h("input", { class: "input", value: b.youtube || "", placeholder: "https://youtu.be/…", type: "url", inputmode: "url" });
    const clipStatus = h("div", { class: "clip-status" });

    const drawPreview = () => {
      const id = youtubeId(b.youtube || "");
      if (b.youtube && id) {
        preview.replaceChildren(h("img", { src: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`, alt: "Video thumbnail" }));
      } else if (b.cloudinary) {
        preview.replaceChildren(h("video", { src: b.cloudinary, controls: true, preload: "metadata" }));
      } else if (b.youtube) {
        preview.replaceChildren(h("p", { class: "error-text" }, "That doesn't look like a YouTube link."));
      } else {
        preview.replaceChildren();
      }
      clipStatus.replaceChildren(b.cloudinary && !b.youtube
        ? h("button", { type: "button", class: "btn btn-small btn-quiet", onClick: () => { delete b.cloudinary; changed(); drawPreview(); } }, "Remove uploaded clip")
        : "");
    };

    link.addEventListener("input", () => {
      b.youtube = link.value.trim();
      if (b.youtube) delete b.cloudinary;
      changed();
      drawPreview();
    });

    const uploadBtn = h("button", { type: "button", class: "btn btn-small", onClick: async () => {
      const bar = progressBar();
      clipStatus.replaceChildren(bar);
      try {
        const url = await uploadVideo(bar.set);
        if (url) {
          b.cloudinary = url;
          b.youtube = "";
          link.value = "";
          changed();
          toast("Clip uploaded");
        }
      } catch (err) {
        toast(err.message, "error");
      }
      drawPreview();
    } }, "Upload a short clip instead");

    drawPreview();
    return [
      field("YouTube link", link, "Upload to YouTube as Unlisted, then paste the link."),
      preview,
      h("div", { class: "row" }, uploadBtn, clipStatus),
      field("Caption", input(b, "caption", { placeholder: "Optional" })),
    ];
  }

  render();
  return root;
}

/* ---------- formatting toolbar for text blocks ----------
   The buttons just type the same symbols the site already understands
   (**bold**, *italic*, __underline__, ++bigger++, ## heading, - list, 1. list, [link](url)),
   so entries written by hand and entries written with the buttons look identical. */

const SVG = (d) => `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const TOOLS = [
  { key: "b", label: "Bold", shortcut: "b", html: "<b>B</b>", run: (a) => wrap(a, "**", "bold text") },
  { key: "i", label: "Italic", shortcut: "i", html: "<i>I</i>", run: (a) => wrap(a, "*", "italic text") },
  { key: "u", label: "Underline", shortcut: "u", html: "<u>U</u>", run: (a) => wrap(a, "__", "underlined text") },
  { key: "big", label: "Bigger text", html: "A<sup>+</sup>", run: (a) => wrap(a, "++", "bigger text") },
  { sep: true },
  { key: "h", label: "Heading", html: "H", run: (a) => linePrefix(a, () => "## ", /^#{2,4}\s+/, "Heading") },
  { key: "ul", label: "Bulleted list", html: SVG('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r=".9" fill="currentColor"/><circle cx="4.5" cy="12" r=".9" fill="currentColor"/><circle cx="4.5" cy="18" r=".9" fill="currentColor"/>'), run: (a) => linePrefix(a, () => "- ", /^[-*]\s+/, "List item") },
  { key: "ol", label: "Numbered list", html: SVG('<path d="M10 6h10M10 12h10M10 18h10"/><path d="M4 5l1.5-1v5M3.6 15.2c.3-.7 1.9-1 2 .1.1.8-2 1.9-2 2.7h2.2" stroke-width="1.5"/>'), run: (a) => linePrefix(a, (i) => `${i + 1}. `, /^\d+[.)]\s+/, "List item") },
  { key: "link", label: "Link", html: SVG('<path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/>'), run: link },
];

function textToolbar(area) {
  const bar = h("div", { class: "fmt-bar", role: "toolbar", "aria-label": "Text formatting" });
  for (const t of TOOLS) {
    if (t.sep) { bar.append(h("span", { class: "fmt-sep", "aria-hidden": "true" })); continue; }
    const btn = h("button", {
      type: "button", class: `fmt-btn fmt-${t.key}`, html: t.html,
      title: t.shortcut ? `${t.label} (Ctrl/⌘ ${t.shortcut.toUpperCase()})` : t.label, "aria-label": t.label,
    });
    // Keep the text box focused (and the phone keyboard open) when a button is pressed.
    btn.addEventListener("pointerdown", (e) => e.preventDefault());
    btn.addEventListener("click", () => t.run(area));
    bar.append(btn);
  }
  area.addEventListener("keydown", (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
    const t = TOOLS.find((x) => x.shortcut === e.key.toLowerCase());
    if (t) { e.preventDefault(); t.run(area); }
  });
  return bar;
}

// Replaces area[start, end) with text, keeping undo working where the browser allows it,
// then selects [selStart, selEnd) and tells the editor something changed.
function replace(area, start, end, text, selStart, selEnd) {
  area.focus();
  area.setSelectionRange(start, end);
  let done = false;
  try { done = document.execCommand("insertText", false, text); } catch { done = false; }
  if (!done || area.value.slice(start, start + text.length) !== text) {
    area.setRangeText(text, start, end, "end");
    area.dispatchEvent(new Event("input", { bubbles: true }));
  }
  area.setSelectionRange(selStart, selEnd);
}

function wrap(area, mark, placeholder) {
  const v = area.value;
  let s = area.selectionStart, e = area.selectionEnd;
  // Leave spaces outside the markers: "word " -> "**word** ".
  while (s < e && /\s/.test(v[s])) s++;
  while (e > s && /\s/.test(v[e - 1])) e--;
  const n = mark.length;
  const before = v.slice(s - n, s), after = v.slice(e, e + n);
  // Italic shouldn't mistake bold's "**" for its own "*".
  const isItalicInsideBold = mark === "*" && (v[s - 2] === "*" && v[e + 1] === "*") && !(v[s - 3] === "*" && v[e + 2] === "*");
  if (before === mark && after === mark && !isItalicInsideBold) {
    // Already formatted: remove the markers.
    replace(area, s - n, e + n, v.slice(s, e), s - n, e - n);
    return;
  }
  const inner = v.slice(s, e);
  const boldNotItalic = mark === "*" && inner.startsWith("**") && !inner.startsWith("***");
  if (!boldNotItalic && inner.startsWith(mark) && inner.endsWith(mark) && inner.length >= n * 2 + 1) {
    replace(area, s, e, inner.slice(n, -n), s, e - n * 2);
    return;
  }
  const text = inner || placeholder;
  replace(area, s, e, mark + text + mark, s + n, s + n + text.length);
}

// Adds (or removes, if every line already has it) a prefix at the start of each selected line.
const ANY_PREFIX = /^(#{2,4}|[-*]|\d+[.)])\s+/;

function linePrefix(area, prefixFor, pattern, placeholder) {
  const v = area.value;
  const s = v.lastIndexOf("\n", area.selectionStart - 1) + 1;
  let e = v.indexOf("\n", area.selectionEnd - (area.selectionEnd > area.selectionStart && v[area.selectionEnd - 1] === "\n" ? 1 : 0));
  if (e === -1) e = v.length;
  const lines = v.slice(s, e).split("\n");
  const all = lines.every((l) => !l.trim() || pattern.test(l));
  let i = 0;
  const out = lines.map((l) => {
    // Switching between heading / bullets / numbers replaces the old marker.
    const bare = l.replace(all ? pattern : ANY_PREFIX, "");
    if (all) return bare;
    if (!bare.trim() && lines.length > 1) return l;
    return prefixFor(i++) + (bare || placeholder);
  }).join("\n");
  replace(area, s, e, out, s, s + out.length);
}

function link(area) {
  const v = area.value;
  let s = area.selectionStart, e = area.selectionEnd;
  while (s < e && /\s/.test(v[s])) s++;
  while (e > s && /\s/.test(v[e - 1])) e--;
  const label = v.slice(s, e) || "link text";
  const text = `[${label}](https://)`;
  // Select "https://" so the web address can be pasted straight over it.
  const urlStart = s + label.length + 3;
  replace(area, s, e, text, urlStart, urlStart + 8);
}

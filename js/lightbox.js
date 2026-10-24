// Full-screen photo viewer built on <dialog>: arrow keys, Esc, swipe, and focus return.

import { imageUrl } from "./media.js";

let dlg, imgEl, capEl, countEl, prevBtn, nextBtn;
let items = [];
let index = 0;
let returnTo = null;

const ICON = {
  close: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  prev: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  next: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

function build() {
  dlg = document.createElement("dialog");
  dlg.className = "lightbox";
  dlg.setAttribute("aria-label", "Photo viewer");
  dlg.innerHTML = `
    <p class="lb-count" aria-live="polite"></p>
    <figure class="lb-figure">
      <img class="lb-img" alt="">
      <figcaption class="lb-cap"></figcaption>
    </figure>
    <button type="button" class="lb-btn lb-prev" aria-label="Previous photo">${ICON.prev}</button>
    <button type="button" class="lb-btn lb-next" aria-label="Next photo">${ICON.next}</button>
    <button type="button" class="lb-btn lb-close" aria-label="Close photo viewer">${ICON.close}</button>`;
  document.body.append(dlg);

  imgEl = dlg.querySelector(".lb-img");
  capEl = dlg.querySelector(".lb-cap");
  countEl = dlg.querySelector(".lb-count");
  prevBtn = dlg.querySelector(".lb-prev");
  nextBtn = dlg.querySelector(".lb-next");

  prevBtn.addEventListener("click", () => show(index - 1));
  nextBtn.addEventListener("click", () => show(index + 1));
  dlg.querySelector(".lb-close").addEventListener("click", () => dlg.close());
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg || e.target.classList.contains("lb-figure")) dlg.close();
  });
  dlg.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") show(index - 1);
    if (e.key === "ArrowRight") show(index + 1);
  });
  dlg.addEventListener("close", () => {
    document.documentElement.classList.remove("lb-open");
    imgEl.removeAttribute("src");
    returnTo?.focus();
  });

  let startX = null;
  dlg.addEventListener("pointerdown", (e) => (startX = e.clientX));
  dlg.addEventListener("pointerup", (e) => {
    if (startX === null) return;
    const dx = e.clientX - startX;
    startX = null;
    if (Math.abs(dx) > 50 && items.length > 1) show(index + (dx < 0 ? 1 : -1));
  });
}

function show(n) {
  index = (n + items.length) % items.length;
  const it = items[index];
  imgEl.src = imageUrl(it.src, 2400);
  imgEl.alt = it.alt || it.caption || "";
  capEl.textContent = it.caption || "";
  capEl.hidden = !it.caption;
  const many = items.length > 1;
  countEl.textContent = many ? `${index + 1} of ${items.length}` : "";
  prevBtn.hidden = nextBtn.hidden = !many;
}

export function openLightbox(list, start = 0, trigger = null) {
  if (!list?.length) return;
  if (!dlg) build();
  items = list;
  returnTo = trigger;
  show(start);
  document.documentElement.classList.add("lb-open");
  dlg.showModal();
}

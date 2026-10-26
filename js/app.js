// Router and page rendering.
// URLs: #/   #/s/<section>   #/s/<section>/<subsection>   #/p/<entry>

import { loadContent } from "./data.js";
import { imageUrl, imageSrcset, youtubeId, cloudinaryVideoUrl } from "./media.js";
import { md, esc } from "./markdown.js";
import { openLightbox } from "./lightbox.js";

const main = document.getElementById("main");
const tabsEl = document.getElementById("tabs");
const leftEl = document.getElementById("side-left");
const rightEl = document.getElementById("side-right");
const galleries = new Map(); // key → [{ src, caption, alt }], rebuilt on every render
let db = null;

// Sections take these colours in turn (see the tokens in css/styles.css).
const PALETTE = ["blush", "sage", "sky", "butter", "rose"];

const ICON = {
  pin: '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="10" r="2.3" fill="currentColor"/></svg>',
  play: '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>',
  sun: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  moon: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
};

/* ---------- formatting ---------- */

function parseDate(iso) {
  if (!iso) return null;
  const [y, m, d] = String(iso).split("-").map(Number);
  return y ? new Date(y, (m || 1) - 1, d || 1) : null;
}
const fmt = (opts) => new Intl.DateTimeFormat("en-IN", opts);
const fullDate = (iso) => { const d = parseDate(iso); return d ? fmt({ day: "numeric", month: "long", year: "numeric" }).format(d) : ""; };
const shortDate = (iso) => { const d = parseDate(iso); return d ? fmt({ day: "numeric", month: "short", year: "numeric" }).format(d) : ""; };
const isoOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function monthRange(posts) {
  const dates = posts.map((p) => parseDate(p.date)).filter(Boolean).sort((a, b) => a - b);
  if (!dates.length) return "";
  const [a, b] = [dates[0], dates[dates.length - 1]];
  const my = fmt({ month: "short", year: "numeric" });
  if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) return my.format(a);
  if (a.getFullYear() === b.getFullYear()) return `${fmt({ month: "short" }).format(a)} – ${my.format(b)}`;
  return `${my.format(a)} – ${my.format(b)}`;
}

const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const byDate = (a, b) => String(a.date || "").localeCompare(String(b.date || ""));
const paragraphs = (text) => String(text || "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${esc(p)}</p>`).join("");

function picture(src, { alt = "", width = 1200, sizes = "100vw", eager = false } = {}) {
  if (!src) return "";
  const set = imageSrcset(src);
  return `<img src="${esc(imageUrl(src, width))}"${set ? ` srcset="${esc(set)}" sizes="${sizes}"` : ""} alt="${esc(alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
}

/* ---------- content index ---------- */

function buildIndex(data) {
  const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.title).localeCompare(String(b.title));
  const sections = [...data.sections].sort(byOrder);
  const subsections = [...data.subsections].sort(byOrder);
  const posts = data.posts.filter((p) => !p.draft);

  const find = (list) => (id) => list.find((x) => x.id === id);
  const subsOf = (sectionId) => subsections.filter((s) => s.sectionId === sectionId);
  const postsOf = (sub) => {
    const list = posts.filter((p) => p.subsectionId === sub.id).sort(byDate);
    return sub.sort === "oldest" ? list : list.reverse();
  };
  const colourOf = (sectionId) => PALETTE[Math.max(0, sections.findIndex((s) => s.id === sectionId)) % PALETTE.length];

  return {
    site: data.site,
    sections, subsections, posts,
    section: find(sections), sub: find(subsections), post: find(posts),
    subsOf, postsOf, colourOf,
  };
}

/* ---------- shared pieces ---------- */

function crumbs(trail) {
  return `<nav aria-label="Breadcrumb"><ol class="crumbs">${trail
    .map(([label, href]) => `<li>${href ? `<a href="${href}">${esc(label)}</a>` : `<span aria-current="page">${esc(label)}</span>`}</li>`)
    .join("")}</ol></nav>`;
}

// A photo print with a handwritten caption.
function polaroid({ href, src, title, note, i = 0, width = 600 }) {
  return `<a class="pol" style="--r:${[-2.2, 1.6, -1, 2.4, -1.6, 1][i % 6]}deg" href="${href}">
    <span class="pol-img">${src ? picture(src, { width, sizes: "(max-width: 700px) 50vw, 240px" }) : ""}</span>
    <span class="pol-cap">${esc(title)}</span>
    ${note ? `<span class="pol-note">${esc(note)}</span>` : ""}
  </a>`;
}

function subPolaroid(sub, i) {
  const posts = db.postsOf(sub);
  const range = monthRange(posts);
  return polaroid({
    href: `#/s/${esc(sub.sectionId)}/${esc(sub.id)}`,
    src: sub.cover || posts[0]?.cover,
    title: sub.title,
    note: `${count(posts.length, "entry", "entries")}${range ? `, ${range}` : ""}`,
    i,
  });
}

/* ---------- views ---------- */

function viewHome() {
  const s = db.site;
  const latest = [...db.posts].sort(byDate).reverse().slice(0, 6);

  const shelves = db.sections.map((sec) => {
    const subs = db.subsOf(sec.id);
    return `<section class="box shelf" data-c="${db.colourOf(sec.id)}" aria-labelledby="shelf-${esc(sec.id)}">
      <h2 id="shelf-${esc(sec.id)}"><a href="#/s/${esc(sec.id)}">${esc(sec.title)}</a></h2>
      ${sec.description ? `<p class="lede">${esc(sec.description)}</p>` : ""}
      ${subs.length ? `<div class="pols">${subs.map(subPolaroid).join("")}</div>` : `<p class="hand empty">Nothing here yet.</p>`}
      <p class="more"><a href="#/s/${esc(sec.id)}">Open ${esc(sec.title)}</a></p>
    </section>`;
  }).join("");

  return {
    title: s.title,
    html: `<section class="box letter">
        <h1>${esc(s.welcomeTitle || "Welcome in")}</h1>
        ${paragraphs(s.intro)}
        ${s.author ? `<p class="hand sign">${esc(s.author)} ♡</p>` : ""}
      </section>
      <div class="home-widgets">${aboutBox("-m")}${nowBox("-m")}${badgesBox("-m")}</div>
      ${latest.length ? `<section class="recent" aria-labelledby="recent-h">
        <h2 id="recent-h">Recently added</h2>
        <div class="pols">${latest.map((p, i) => polaroid({ href: `#/p/${esc(p.id)}`, src: p.cover, title: p.title, note: shortDate(p.date), i })).join("")}</div>
      </section>` : ""}
      ${shelves || `<p class="hand empty">Add a section in the admin panel to get started.</p>`}`,
  };
}

function viewSection(secId) {
  const sec = db.section(secId);
  if (!sec) return null;
  const subs = db.subsOf(sec.id);
  return {
    title: sec.title,
    section: sec.id,
    html: `${crumbs([["Home", "#/"], [sec.title]])}
      <header class="page-head" data-c="${db.colourOf(sec.id)}">
        <h1>${esc(sec.title)}</h1>
        ${sec.description ? `<p class="lede">${esc(sec.description)}</p>` : ""}
      </header>
      ${sec.cover ? `<div class="framed wide-photo">${picture(sec.cover, { width: 1600, sizes: "(max-width: 960px) 100vw, 680px", eager: true })}</div>` : ""}
      ${subs.length ? `<div class="pols pols-lg">${subs.map(subPolaroid).join("")}</div>` : `<p class="hand empty">Nothing in ${esc(sec.title)} yet.</p>`}`,
  };
}

function viewSub(secId, subId) {
  const sec = db.section(secId);
  const sub = db.sub(subId);
  if (!sec || !sub || sub.sectionId !== sec.id) return null;
  const posts = db.postsOf(sub);
  const range = monthRange(posts);

  const items = posts.map((p) => `<article class="item">
      ${p.cover ? `<a class="item-photo" href="#/p/${esc(p.id)}" tabindex="-1" aria-hidden="true">${picture(p.cover, { width: 500, sizes: "(max-width: 600px) 100vw, 220px" })}</a>` : ""}
      <div class="item-text">
        <h2><a href="#/p/${esc(p.id)}">${esc(p.title)}</a></h2>
        <p class="meta">${p.date ? `<time datetime="${esc(p.date)}">${esc(fullDate(p.date))}</time>` : ""}${p.location ? `<span class="with-icon">${ICON.pin}${esc(p.location)}</span>` : ""}</p>
        ${p.excerpt ? `<p>${esc(p.excerpt)}</p>` : ""}
        <p class="more"><a href="#/p/${esc(p.id)}">Read the entry</a></p>
      </div>
    </article>`).join("");

  return {
    title: sub.title,
    section: sec.id,
    html: `${crumbs([["Home", "#/"], [sec.title, `#/s/${sec.id}`], [sub.title]])}
      <header class="page-head" data-c="${db.colourOf(sec.id)}">
        <h1>${esc(sub.title)}</h1>
        ${sub.description ? `<p class="lede">${esc(sub.description)}</p>` : ""}
        <p class="hand page-note">${count(posts.length, "entry", "entries")}${range ? `, ${range}` : ""}</p>
      </header>
      ${posts.length ? `<div class="items">${items}</div>` : `<p class="hand empty">No entries here yet.</p>`}`,
  };
}

function renderBlock(b, i, postId) {
  const caption = b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : "";
  const key = `${postId}-${i}`;
  switch (b.type) {
    case "text":
      return `<div class="prose">${md(b.body)}</div>`;

    case "image":
      galleries.set(key, [{ src: b.src, caption: b.caption, alt: b.alt }]);
      return `<figure class="fig${b.wide ? " fig--wide" : ""}">
        <button type="button" class="zoom framed" data-gallery="${key}" data-index="0">${picture(b.src, { alt: b.alt || b.caption || "Photo", width: 1400, sizes: "(max-width: 960px) 100vw, 680px" })}</button>
        ${caption}
      </figure>`;

    case "gallery": {
      const imgs = (b.images || []).filter((x) => x?.src);
      if (!imgs.length) return "";
      galleries.set(key, imgs);
      return `<figure class="fig gallery">
        <div class="gallery-grid" data-count="${imgs.length}">${imgs
          .map((im, n) => `<button type="button" class="zoom pol pol-photo" style="--r:${[-1.8, 1.4, -0.8, 2, -1.4, 0.9][n % 6]}deg" data-gallery="${key}" data-index="${n}">
            <span class="pol-img">${picture(im.src, { alt: im.alt || im.caption || `Photo ${n + 1}`, width: 700, sizes: "(max-width: 700px) 50vw, 230px" })}</span>
            ${im.caption ? `<span class="pol-cap">${esc(im.caption)}</span>` : ""}
          </button>`)
          .join("")}</div>
        ${caption}
      </figure>`;
    }

    case "video": {
      if (b.youtube) {
        const id = youtubeId(b.youtube);
        if (!id) return "";
        return `<figure class="fig">
          <div class="video framed">
            <button type="button" class="yt-facade" data-yt="${esc(id)}" aria-label="Play video${b.caption ? `: ${esc(b.caption)}` : ""}">
              <img src="https://i.ytimg.com/vi/${esc(id)}/hqdefault.jpg" alt="" loading="lazy">
              <span class="play">${ICON.play}</span>
            </button>
          </div>
          ${caption}
        </figure>`;
      }
      if (b.cloudinary) {
        return `<figure class="fig"><div class="video framed"><video controls playsinline preload="metadata" src="${esc(cloudinaryVideoUrl(b.cloudinary))}"></video></div>${caption}</figure>`;
      }
      return "";
    }

    case "quote":
      return `<blockquote class="quote"><p>${esc(b.text)}</p>${b.cite ? `<cite class="hand">${esc(b.cite)}</cite>` : ""}</blockquote>`;

    default:
      return "";
  }
}

function viewPost(postId) {
  const p = db.post(postId);
  if (!p) return null;
  const sub = db.sub(p.subsectionId);
  const sec = sub && db.section(sub.sectionId);

  const chrono = sub ? db.postsOf(sub).slice().sort(byDate) : [];
  const at = chrono.findIndex((x) => x.id === p.id);
  const earlier = chrono[at - 1];
  const later = chrono[at + 1];

  const trail = [["Home", "#/"]];
  if (sec) trail.push([sec.title, `#/s/${sec.id}`]);
  if (sub && sec) trail.push([sub.title, `#/s/${sec.id}/${sub.id}`]);

  const blocks = (p.blocks || []).map((b, i) => renderBlock(b, i, p.id)).join("");

  return {
    title: p.title,
    section: sec?.id,
    html: `${crumbs(trail)}
      <article class="box post" data-c="${sec ? db.colourOf(sec.id) : "blush"}">
        <header class="post-head">
          <h1>${esc(p.title)}</h1>
          <p class="meta">${p.date ? `<time datetime="${esc(p.date)}">${esc(fullDate(p.date))}</time>` : ""}${p.location ? `<span class="with-icon">${ICON.pin}${esc(p.location)}</span>` : ""}</p>
          ${p.excerpt ? `<p class="lede">${esc(p.excerpt)}</p>` : ""}
        </header>
        ${p.cover ? `<div class="framed post-cover">${picture(p.cover, { alt: "", width: 1600, sizes: "(max-width: 960px) 100vw, 680px", eager: true })}</div>` : ""}
        <div class="post-body">${blocks}</div>
      </article>
      ${earlier || later ? `<nav class="post-nav" aria-label="More from ${esc(sub?.title || "this collection")}">
        ${earlier ? `<a class="prev" href="#/p/${esc(earlier.id)}"><span class="hand">earlier</span><strong>${esc(earlier.title)}</strong></a>` : "<span></span>"}
        ${later ? `<a class="next" href="#/p/${esc(later.id)}"><span class="hand">later</span><strong>${esc(later.title)}</strong></a>` : ""}
      </nav>` : ""}`,
  };
}

function viewNotFound() {
  return {
    title: "Page not found",
    html: `<section class="box letter">
      <h1>This page doesn't exist</h1>
      <p>It may have been renamed or removed.</p>
      <p><a class="pill" href="#/">Go to the home page</a></p>
    </section>`,
  };
}

function viewBackSoon() {
  return `<section class="box letter back-soon">
    <p class="hand back-soon-kicker">gone for a little walk…</p>
    <h1>Back soon</h1>
    <p>The scrapbook is taking a short break and will be back in a few hours. Nothing's lost: every page is safe and will be right here when it returns.</p>
    <p class="hand back-soon-sign">see you again soon ♡</p>
    <p><button type="button" class="pill" onclick="location.reload()">Try again</button></p>
  </section>`;
}

function viewError(err) {
  if (err.unavailable) return viewBackSoon();
  const local = location.protocol === "file:";
  return `<section class="box letter">
    <h1>The content didn't load</h1>
    <p>${esc(err.message)}</p>
    <p>${local
      ? "The site was opened straight from your files. Run it through a local server instead (see README.md), then reload."
      : "Check your connection, then reload."}</p>
  </section>`;
}

/* ---------- chrome: header, tabs, side widgets ---------- */

function renderHeader() {
  const s = db.site;
  document.querySelector(".site-title").textContent = s.title;
  const tag = document.querySelector(".tagline");
  tag.hidden = !s.tagline;
  tag.innerHTML = s.tagline ? `<span aria-hidden="true">✦</span> ${esc(s.tagline)} <span aria-hidden="true">✦</span>` : "";
  document.getElementById("site-foot").textContent = `© ${new Date().getFullYear()} ${s.author || s.title}`;
}

function renderTabs(current) {
  tabsEl.innerHTML = [`<a class="tab" data-c="none" href="#/"${current === "home" ? ' aria-current="page"' : ""}>Home</a>`,
    ...db.sections.map((sec) => `<a class="tab" data-c="${db.colourOf(sec.id)}" href="#/s/${esc(sec.id)}"${current === sec.id ? ' aria-current="page"' : ""}>${esc(sec.title)}</a>`),
  ].join("");
}

function calendarBox() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const first = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const byDay = new Map();
  for (const p of db.posts) if (p.date && !byDay.has(p.date)) byDay.set(p.date, p);

  let cells = "<tr>" + "<td></td>".repeat(first);
  for (let d = 1; d <= days; d++) {
    if ((first + d - 1) % 7 === 0 && d > 1) cells += "</tr><tr>";
    const iso = isoOf(new Date(y, m, d));
    const post = byDay.get(iso);
    const today = d === now.getDate();
    const label = post ? `<a href="#/p/${esc(post.id)}" title="${esc(post.title)}" aria-label="${d}: ${esc(post.title)}">${d}</a>` : d;
    cells += `<td class="${[today ? "today" : "", post ? "has-entry" : ""].join(" ").trim()}"${today ? ' aria-current="date"' : ""}>${label}</td>`;
  }
  cells += "</tr>";

  return `<section class="box cal-box" aria-labelledby="cal-h">
    <h3 id="cal-h">${fmt({ month: "long", year: "numeric" }).format(now)}</h3>
    <table class="cal"><thead><tr>${["S", "M", "T", "W", "T", "F", "S"].map((d, i) => `<th scope="col" abbr="${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][i]}">${d}</th>`).join("")}</tr></thead><tbody>${cells}</tbody></table>
    <p class="hand cal-note">dotted days have an entry</p>
  </section>`;
}

function contentsBox(where) {
  return `<section class="box contents-box" aria-labelledby="contents-h">
    <h3 id="contents-h">Contents</h3>
    <ul class="contents">${db.sections.map((sec) => `
      <li><a href="#/s/${esc(sec.id)}"${where.exact === "section" && where.sectionId === sec.id ? ' aria-current="page"' : ""}>${esc(sec.title)}</a>
        ${db.subsOf(sec.id).length ? `<ul>${db.subsOf(sec.id).map((sub) => `<li><a href="#/s/${esc(sec.id)}/${esc(sub.id)}"${where.subId === sub.id && where.exact === "sub" ? ' aria-current="page"' : ""}>${esc(sub.title)}</a></li>`).join("")}</ul>` : ""}
      </li>`).join("")}
    </ul>
  </section>`;
}

// The boxes below appear on the home page only. `k` keeps their IDs unique
// when the phone layout shows a second copy inside the page.
function badgesBox(k = "") {
  const badges = (db.site.badges || []).map((b) => String(b).trim()).filter(Boolean);
  if (!badges.length) return "";
  return `<section class="box badges-box" aria-labelledby="badges-h${k}">
    <h3 id="badges-h${k}">Badges</h3>
    <ul class="badges">${badges.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
  </section>`;
}

const HEART = '<svg viewBox="0 0 24 24" width="56" height="56" aria-hidden="true"><path d="M12 20s-7.5-4.6-7.5-10.1A4.2 4.2 0 0 1 12 7.4a4.2 4.2 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';

function aboutBox(k = "") {
  const a = db.site.about || {};
  if (!a.photo && !a.line) return "";
  return `<section class="box about-box" aria-labelledby="about-h${k}">
    <h3 id="about-h${k}">${esc(a.title || "About me")}</h3>
    <div class="portrait${a.photo ? "" : " portrait-empty"}">${a.photo
      ? picture(a.photo, { alt: db.site.author ? `Photo of ${db.site.author}` : "", width: 400, sizes: "200px" })
      : HEART}</div>
    ${a.line ? `<p class="about-line">${esc(a.line)}</p>` : ""}
  </section>`;
}

function nowBox(k = "") {
  const rows = (db.site.now || []).filter((r) => r?.label && r?.value);
  if (!rows.length) return "";
  return `<section class="box now" aria-labelledby="now-h${k}">
    <h3 id="now-h${k}">Right now</h3>
    <dl>${rows.map((r) => `<div><dt>${esc(r.label)}</dt><dd>${esc(r.value)}</dd></div>`).join("")}</dl>
  </section>`;
}

function renderSides(where) {
  const home = where.exact === "home";
  document.body.classList.toggle("is-home", home);
  leftEl.innerHTML = calendarBox() + (home ? badgesBox() : "") + contentsBox(where);
  rightEl.innerHTML = home ? aboutBox() + nowBox() : "";
  rightEl.hidden = !rightEl.innerHTML.trim();
  document.body.classList.toggle("has-right", !rightEl.hidden);
}

/* ---------- router ---------- */

function parseRoute() {
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  if (!parts.length) return { view: viewHome(), where: { exact: "home" } };
  const [kind, a, b] = parts;
  if (kind === "s" && parts.length === 2) return { view: viewSection(a), where: { exact: "section", sectionId: a } };
  if (kind === "s" && parts.length === 3) return { view: viewSub(a, b), where: { exact: "sub", sectionId: a, subId: b } };
  if (kind === "p" && parts.length === 2) {
    const p = db.post(a);
    const sub = p && db.sub(p.subsectionId);
    return { view: viewPost(a), where: { exact: "post", subId: sub?.id, sectionId: sub?.sectionId } };
  }
  return { view: null, where: {} };
}

let firstRender = true;
function render() {
  galleries.clear();
  const { view, where } = parseRoute();
  const v = view || viewNotFound();
  main.innerHTML = `<div class="page">${v.html}</div>`;
  document.title = v.title === db.site.title ? v.title : `${v.title} – ${db.site.title}`;
  renderTabs(where.exact === "home" ? "home" : v.section);
  renderSides(where);
  // On phones the tabs scroll sideways; keep the current one in view.
  const tab = tabsEl.querySelector('[aria-current="page"]');
  if (tab && tabsEl.scrollWidth > tabsEl.clientWidth) {
    tabsEl.scrollTo({ left: tab.offsetLeft - (tabsEl.clientWidth - tab.offsetWidth) / 2, behavior: firstRender ? "auto" : "smooth" });
  }
  if (!firstRender) {
    window.scrollTo(0, 0);
    main.focus({ preventScroll: true });
  }
  firstRender = false;
}

/* ---------- interactions ---------- */

main.addEventListener("click", (e) => {
  const zoom = e.target.closest("[data-gallery]");
  if (zoom) {
    openLightbox(galleries.get(zoom.dataset.gallery), Number(zoom.dataset.index) || 0, zoom);
    return;
  }
  const yt = e.target.closest("[data-yt]");
  if (yt) {
    const frame = document.createElement("iframe");
    frame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(yt.dataset.yt)}?autoplay=1&rel=0`;
    frame.title = yt.getAttribute("aria-label")?.replace(/^Play video:?\s*/, "") || "YouTube video";
    frame.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    frame.allowFullscreen = true;
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    yt.replaceWith(frame);
    frame.focus();
  }
});

// Skip link (handled in JS because # links are used for routing)
document.querySelector(".skip").addEventListener("click", (e) => {
  e.preventDefault();
  main.focus();
});

// Light / dark theme
const themeBtn = document.querySelector(".theme-btn");
function paintThemeButton() {
  const dark = document.documentElement.dataset.theme === "dark";
  themeBtn.innerHTML = dark ? ICON.sun : ICON.moon;
  themeBtn.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
}
themeBtn.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem("theme", next); } catch { /* storage unavailable */ }
  paintThemeButton();
});
paintThemeButton();

/* ---------- start ---------- */

(async function start() {
  try {
    db = buildIndex(await loadContent());
    renderHeader();
    render();
    window.addEventListener("hashchange", render);
  } catch (err) {
    console.error(err);
    // Keep the page looking like the site: use the name from the browser tab title.
    document.querySelector(".site-title").textContent = document.title;
    document.getElementById("site-foot").textContent = `© ${new Date().getFullYear()} ${document.title}`;
    leftEl.hidden = rightEl.hidden = true;
    document.body.classList.add("is-solo");
    main.innerHTML = viewError(err);
  }
})();

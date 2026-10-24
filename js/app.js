// Router and page rendering.
// URLs: #/  ·  #/s/<section>  ·  #/s/<section>/<subsection>  ·  #/p/<entry>

import { loadContent } from "./data.js";
import { imageUrl, imageSrcset, youtubeId, cloudinaryVideoUrl } from "./media.js";
import { md, esc } from "./markdown.js";
import { openLightbox } from "./lightbox.js";

const main = document.getElementById("main");
const sidebar = document.getElementById("sidebar");
const galleries = new Map(); // key → [{ src, caption, alt }], rebuilt on every render
let db = null;
let firstRender = true;

const ICON = {
  pin: '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="10" r="2.3" fill="currentColor"/></svg>',
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

  return {
    site: data.site,
    sections, subsections, posts,
    section: find(sections), sub: find(subsections), post: find(posts),
    subsOf, postsOf,
  };
}

/* ---------- shared pieces ---------- */

function crumbs(trail) {
  return `<nav aria-label="Breadcrumb"><ol class="crumbs">${trail
    .map(([label, href]) => `<li>${href ? `<a href="${href}">${esc(label)}</a>` : `<span aria-current="page">${esc(label)}</span>`}</li>`)
    .join("")}</ol></nav>`;
}

function subTile(sub) {
  const posts = db.postsOf(sub);
  const cover = sub.cover || posts[0]?.cover;
  return `<a class="tile" href="#/s/${esc(sub.sectionId)}/${esc(sub.id)}">
    <div class="tile-img">${picture(cover, { width: 800, sizes: "(max-width: 700px) 100vw, 360px" })}</div>
    <h3>${esc(sub.title)}</h3>
    <p class="meta"><span>${count(posts.length, "entry", "entries")}</span>${posts.length ? `<span>${monthRange(posts)}</span>` : ""}</p>
  </a>`;
}

function footer() {
  const who = db.site.author || db.site.title;
  return `<footer class="foot"><p>© ${new Date().getFullYear()} ${esc(who)}</p><a href="#/">Back to the start</a></footer>`;
}

/* ---------- views ---------- */

function viewHome() {
  const latest = [...db.posts].sort(byDate).reverse().slice(0, 5);
  const mosaic = latest.length
    ? `<div class="mosaic" data-count="${latest.length}">${latest
        .map((p, i) => `<a class="m-tile" style="--i:${i}" href="#/p/${esc(p.id)}">
          ${picture(p.cover, { width: i === 0 ? 1400 : 700, sizes: i === 0 ? "(max-width: 700px) 100vw, 50vw" : "(max-width: 700px) 50vw, 25vw", eager: i === 0 })}
          <span class="m-cap">${esc(p.title)}<small>${esc(fullDate(p.date))}</small></span>
        </a>`).join("")}</div>`
    : "";

  const shelves = db.sections.map((sec) => {
    const subs = db.subsOf(sec.id);
    return `<section class="shelf" aria-labelledby="shelf-${esc(sec.id)}">
      <div class="shelf-head">
        <h2 id="shelf-${esc(sec.id)}"><a href="#/s/${esc(sec.id)}">${esc(sec.title)}</a></h2>
        <a class="link" href="#/s/${esc(sec.id)}">Open ${esc(sec.title)}</a>
      </div>
      ${sec.description ? `<p class="shelf-desc">${esc(sec.description)}</p>` : ""}
      ${subs.length ? `<div class="tiles">${subs.map(subTile).join("")}</div>` : `<p class="empty">Nothing in this section yet.</p>`}
    </section>`;
  }).join("");

  return {
    title: db.site.title,
    html: `<div class="wrap">
      <header class="hero">
        <h1 class="hero-title">${esc(db.site.title)}</h1>
        ${db.site.intro ? `<p class="hero-intro">${esc(db.site.intro)}</p>` : ""}
      </header>
      ${mosaic}
      ${shelves || `<p class="empty">Add a section in content/site.json to get started.</p>`}
      ${footer()}
    </div>`,
  };
}

function viewSection(secId) {
  const sec = db.section(secId);
  if (!sec) return null;
  const subs = db.subsOf(sec.id);
  return {
    title: sec.title,
    html: `<div class="wrap">
      ${crumbs([["Home", "#/"], [sec.title]])}
      <header class="page-head">
        <h1 class="page-title">${esc(sec.title)}</h1>
        ${sec.description ? `<p class="page-desc">${esc(sec.description)}</p>` : ""}
      </header>
      ${sec.cover ? `<div class="banner">${picture(sec.cover, { width: 2000, sizes: "(max-width: 900px) 100vw, 72rem", eager: true })}</div>` : ""}
      ${subs.length ? `<div class="tiles tiles--section">${subs.map(subTile).join("")}</div>` : `<p class="empty">No collections in ${esc(sec.title)} yet.</p>`}
      ${footer()}
    </div>`,
  };
}

function viewSub(secId, subId) {
  const sec = db.section(secId);
  const sub = db.sub(subId);
  if (!sec || !sub || sub.sectionId !== sec.id) return null;
  const posts = db.postsOf(sub);
  const list = posts.map((p) => `<li class="entry">
      <a href="#/p/${esc(p.id)}">
        <time datetime="${esc(p.date || "")}">${esc(fullDate(p.date))}</time>
        <div class="entry-body">
          <h2>${esc(p.title)}</h2>
          ${p.excerpt ? `<p>${esc(p.excerpt)}</p>` : ""}
          ${p.location ? `<p class="entry-loc">${ICON.pin}${esc(p.location)}</p>` : ""}
        </div>
        <div class="entry-thumb">${picture(p.cover, { width: 600, sizes: "(max-width: 760px) 100vw, 15rem" })}</div>
      </a>
    </li>`).join("");

  return {
    title: sub.title,
    html: `<div class="wrap">
      ${crumbs([["Home", "#/"], [sec.title, `#/s/${sec.id}`], [sub.title]])}
      <header class="page-head">
        <h1 class="page-title">${esc(sub.title)}</h1>
        ${sub.description ? `<p class="page-desc">${esc(sub.description)}</p>` : ""}
        <p class="meta page-meta"><span>${count(posts.length, "entry", "entries")}</span>${posts.length ? `<span>${monthRange(posts)}</span>` : ""}</p>
      </header>
      ${posts.length ? `<ol class="entries">${list}</ol>` : `<p class="empty">No entries here yet.</p>`}
      ${footer()}
    </div>`,
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
        <button type="button" class="zoom" data-gallery="${key}" data-index="0">${picture(b.src, { alt: b.alt || b.caption || "Photo", width: b.wide ? 1800 : 1200, sizes: b.wide ? "(max-width: 900px) 100vw, 60rem" : "(max-width: 760px) 100vw, 42rem" })}</button>
        ${caption}
      </figure>`;

    case "gallery": {
      const imgs = (b.images || []).filter((x) => x?.src);
      if (!imgs.length) return "";
      galleries.set(key, imgs);
      return `<figure class="fig fig--wide gallery">
        <div class="gallery-grid" data-count="${imgs.length}">${imgs
          .map((im, n) => `<button type="button" class="zoom" data-gallery="${key}" data-index="${n}">${picture(im.src, { alt: im.alt || im.caption || `Photo ${n + 1}`, width: 800, sizes: "(max-width: 760px) 50vw, 20rem" })}</button>`)
          .join("")}</div>
        ${caption}
      </figure>`;
    }

    case "video": {
      if (b.youtube) {
        const id = youtubeId(b.youtube);
        if (!id) return "";
        return `<figure class="fig fig--wide">
          <div class="video">
            <button type="button" class="yt-facade" data-yt="${esc(id)}" aria-label="Play video${b.caption ? `: ${esc(b.caption)}` : ""}">
              <img src="https://i.ytimg.com/vi/${esc(id)}/hqdefault.jpg" alt="" loading="lazy">
              <span class="play">${ICON.play}</span>
            </button>
          </div>
          ${caption}
        </figure>`;
      }
      if (b.cloudinary) {
        return `<figure class="fig fig--wide"><div class="video"><video controls playsinline preload="metadata" src="${esc(cloudinaryVideoUrl(b.cloudinary))}"></video></div>${caption}</figure>`;
      }
      return "";
    }

    case "quote":
      return `<blockquote class="quote"><p>${esc(b.text)}</p>${b.cite ? `<cite>${esc(b.cite)}</cite>` : ""}</blockquote>`;

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
    html: `<article class="wrap post">
      ${crumbs(trail)}
      <header class="post-head">
        <h1 class="page-title">${esc(p.title)}</h1>
        <p class="meta post-meta">
          ${p.date ? `<time datetime="${esc(p.date)}">${esc(fullDate(p.date))}</time>` : ""}
          ${p.location ? `<span class="with-icon">${ICON.pin}${esc(p.location)}</span>` : ""}
        </p>
        ${p.excerpt ? `<p class="post-dek">${esc(p.excerpt)}</p>` : ""}
      </header>
      ${p.cover ? `<div class="post-cover">${picture(p.cover, { alt: "", width: 2000, sizes: "(max-width: 900px) 100vw, 72rem", eager: true })}</div>` : ""}
      <div class="post-body">${blocks}</div>
      ${earlier || later ? `<nav class="post-nav" aria-label="More from ${esc(sub?.title || "this collection")}">
        ${earlier ? `<a class="prev" href="#/p/${esc(earlier.id)}"><small>Earlier entry</small><strong>${esc(earlier.title)}</strong></a>` : ""}
        ${later ? `<a class="next" href="#/p/${esc(later.id)}"><small>Later entry</small><strong>${esc(later.title)}</strong></a>` : ""}
      </nav>` : ""}
      ${footer()}
    </article>`,
  };
}

function viewNotFound() {
  return {
    title: "Page not found",
    html: `<div class="wrap state">
      <h1 class="page-title">This page doesn't exist</h1>
      <p class="page-desc">It may have been renamed or removed.</p>
      <p><a class="button" href="#/">Go to the home page</a></p>
    </div>`,
  };
}

function viewError(err) {
  const local = location.protocol === "file:";
  return `<div class="wrap state">
    <h1 class="page-title">The content didn't load</h1>
    <p class="page-desc">${esc(err.message)}</p>
    <p class="page-desc">${local
      ? "The site was opened straight from your files. Run it through a local server instead (see README.md), then reload."
      : "Check that content/site.json exists and is valid JSON, then reload."}</p>
  </div>`;
}

/* ---------- sidebar ---------- */

function renderSidebar(where) {
  const { sectionId, subId, exact } = where;
  const cur = (cond) => (cond ? ' aria-current="page"' : "");
  sidebar.innerHTML = `<div class="side-inner">
    <a class="side-home${exact === "home" ? " is-active" : ""}" href="#/"${cur(exact === "home")}>Home</a>
    <ul class="tree">${db.sections.map((sec) => `
      <li>
        <a class="tree-sec${sectionId === sec.id ? " is-active" : ""}" href="#/s/${esc(sec.id)}"${cur(exact === "section" && sectionId === sec.id)}>${esc(sec.title)}</a>
        ${db.subsOf(sec.id).length ? `<ul>${db.subsOf(sec.id).map((sub) => `
          <li><a class="tree-sub${subId === sub.id ? " is-active" : ""}" href="#/s/${esc(sec.id)}/${esc(sub.id)}"${cur(exact === "sub" && subId === sub.id)}>
            <span>${esc(sub.title)}</span><span class="count">${db.postsOf(sub).length}</span>
          </a></li>`).join("")}</ul>` : ""}
      </li>`).join("")}
    </ul>
  </div>`;
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

function render() {
  galleries.clear();
  const { view, where } = parseRoute();
  const v = view || viewNotFound();
  main.classList.toggle("intro", firstRender && where.exact === "home");
  main.innerHTML = v.html;
  document.title = v.title === db.site.title ? v.title : `${v.title} – ${db.site.title}`;
  renderSidebar(where);
  setNav(false);
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

// Mobile navigation drawer
const menuBtn = document.querySelector(".menu-btn");
const scrim = document.querySelector(".scrim");
function setNav(open) {
  document.body.classList.toggle("nav-open", open);
  menuBtn.setAttribute("aria-expanded", String(open));
  scrim.hidden = !open;
}
menuBtn.addEventListener("click", () => setNav(!document.body.classList.contains("nav-open")));
scrim.addEventListener("click", () => setNav(false));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && document.body.classList.contains("nav-open")) {
    setNav(false);
    menuBtn.focus();
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
    document.querySelector(".brand").textContent = db.site.title;
    render();
    window.addEventListener("hashchange", render);
  } catch (err) {
    console.error(err);
    main.innerHTML = viewError(err);
  }
})();

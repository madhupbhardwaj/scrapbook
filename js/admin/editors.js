// Editor screens: overview, site settings, section, sub-section and entry.

import { CONFIG } from "../config.js";
import { imageUrl } from "../media.js";
import { h, field, toast, confirmDialog, errorMessage, uniqueId, iconButton } from "./ui.js";
import { saveItem, saveMany, saveSite, deleteMany } from "./store.js";
import { imagePicker } from "./upload.js";
import { blockEditor } from "./blocks.js";

/* ---------- shared ---------- */

const clone = (o) => JSON.parse(JSON.stringify(o));
const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.title).localeCompare(String(b.title));
const nextOrder = (list) => list.reduce((m, x) => Math.max(m, x.order ?? 0), 0) + 1;

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(y, m - 1, d || 1));
}

function shell({ context, title, status, intro, form, actions }) {
  return h("div", { class: "ed" },
    h("div", { class: "ed-head" },
      context ? h("p", { class: "ed-context" }, context) : null,
      h("div", { class: "ed-title-row" }, h("h1", { class: "ed-title" }, title), status || null),
      intro ? h("p", { class: "ed-intro muted" }, intro) : null,
    ),
    form ? h("form", { class: "ed-form", novalidate: true, onSubmit: (e) => e.preventDefault() }, form) : null,
    actions ? h("div", { class: "ed-actions" }, actions) : null,
  );
}

// Runs an async save with the button showing progress; shows errors as toasts.
async function busy(button, label, fn) {
  const original = button.textContent;
  const buttons = button.closest(".ed-actions, .ed, form")?.querySelectorAll("button") || [button];
  buttons.forEach((b) => (b.disabled = true));
  button.textContent = label;
  try {
    await fn();
  } catch (err) {
    console.error(err);
    toast(errorMessage(err), "error");
  } finally {
    if (button.isConnected) {
      buttons.forEach((b) => (b.disabled = false));
      button.textContent = original;
    }
  }
}

function textInput(obj, key, attrs = {}) {
  const el = h(attrs.multiline ? "textarea" : "input", {
    class: "input", value: obj[key] || "", type: attrs.multiline ? null : attrs.type || "text",
    rows: attrs.rows, placeholder: attrs.placeholder, required: attrs.required, maxlength: attrs.maxlength,
  });
  el.addEventListener("input", () => (obj[key] = el.value));
  return el;
}

function errorBox() {
  const el = h("p", { class: "error-text form-error", role: "alert" });
  el.show = (msg, focusEl) => {
    el.textContent = msg;
    focusEl?.focus();
  };
  el.clear = () => (el.textContent = "");
  return el;
}

function viewLink(href, label = "View on site") {
  return h("a", { class: "btn btn-quiet", href, target: "_blank", rel: "noopener" }, label);
}

// Swap an item's order with its neighbour among `siblings` and save both.
async function reorder(collection, siblings, item, delta) {
  const sorted = [...siblings].sort(byOrder);
  sorted.forEach((s, i) => (s.order = i + 1));
  const i = sorted.findIndex((s) => s.id === item.id);
  const j = i + delta;
  if (j < 0 || j >= sorted.length) return false;
  [sorted[i].order, sorted[j].order] = [sorted[j].order, sorted[i].order];
  await saveMany(sorted.map((s) => ({ collection, item: s })));
  return true;
}

/* ---------- overview ---------- */

export function overview(ctx) {
  const d = ctx.data;
  const drafts = d.posts.filter((p) => p.draft).length;
  const recent = [...d.posts]
    .sort((a, b) => String(b.updatedAt || b.date || "").localeCompare(String(a.updatedAt || a.date || "")))
    .slice(0, 8);
  const subName = (id) => d.subsections.find((s) => s.id === id)?.title || "No sub-section";

  const empty = !d.sections.length;

  return h("div", { class: "ed" },
    h("div", { class: "ed-head" },
      h("h1", { class: "ed-title" }, `Hello, ${ctx.username}`),
      h("p", { class: "ed-intro muted" }, empty
        ? "Your database is empty. Bring in what's already on the site, or start fresh."
        : "Pick something from the list to edit it, or start a new entry.")),

    empty
      ? h("div", { class: "card card-accent" },
          h("h2", {}, "Move your current content into the panel"),
          h("p", { class: "muted" }, "Copies every section, sub-section and entry from content/site.json into the database, so you can edit it all here. Your public site switches over automatically once this is done."),
          h("div", { class: "row" },
            h("button", { type: "button", class: "btn btn-primary", onClick: (e) => importJson(ctx, e.currentTarget) }, "Import content/site.json"),
            h("a", { class: "btn", href: "#new/section" }, "Start with a new section")))
      : h("div", { class: "stats" },
          stat(d.sections.length, "sections"),
          stat(d.subsections.length, "sub-sections"),
          stat(d.posts.length - drafts, "published entries"),
          stat(drafts, "drafts")),

    !empty ? h("div", { class: "row" },
      h("a", { class: "btn btn-primary", href: "#new/post" }, "New entry"),
      h("a", { class: "btn", href: "#new/section" }, "New section")) : null,

    recent.length ? h("section", { class: "recent" },
      h("h2", {}, "Recently edited"),
      h("ul", { class: "recent-list" }, recent.map((p) =>
        h("li", {}, h("a", { href: `#post/${p.id}` },
          h("span", { class: "recent-thumb" }, p.cover ? h("img", { src: imageUrl(p.cover, 160), alt: "", loading: "lazy" }) : null),
          h("span", { class: "recent-text" },
            h("strong", {}, p.title || "Untitled entry"),
            h("span", { class: "muted" }, `${subName(p.subsectionId)}${p.date ? `, ${formatDate(p.date)}` : ""}`)),
          p.draft ? h("span", { class: "badge" }, "Draft") : null))))) : null,
  );
}

function stat(n, label) {
  return h("div", { class: "stat" }, h("strong", {}, String(n)), h("span", {}, label));
}

async function importJson(ctx, button) {
  let json;
  try {
    const res = await fetch(CONFIG.contentUrl, { cache: "no-cache" });
    if (!res.ok) throw new Error(`Couldn't load ${CONFIG.contentUrl} (HTTP ${res.status}).`);
    json = await res.json();
  } catch (err) {
    toast(err.message, "error");
    return;
  }
  const sections = json.sections || [];
  const subsections = json.subsections || [];
  const posts = json.posts || [];
  const ok = await confirmDialog({
    title: "Import content/site.json?",
    message: `This copies ${sections.length} sections, ${subsections.length} sub-sections and ${posts.length} entries into the database. Anything already there with the same web address is replaced.`,
    confirmLabel: "Import",
  });
  if (!ok) return;

  await busy(button, "Importing…", async () => {
    const stamp = new Date().toISOString();
    const writes = [
      ...sections.map((item) => ({ collection: "sections", item })),
      ...subsections.map((item) => ({ collection: "subsections", item })),
      ...posts.map((p) => ({ collection: "posts", item: { ...p, draft: p.draft === true, updatedAt: stamp, updatedBy: ctx.username } })),
    ].filter((w) => w.item?.id);
    await saveMany(writes);
    if (json.site) await saveSite(json.site);
    toast("Import finished");
    await ctx.reload();
  });
}

/* ---------- site settings ---------- */

export function siteEditor(ctx) {
  const site = clone({ title: "", tagline: "", welcomeTitle: "", intro: "", author: "", about: {}, now: [], ...ctx.data.site });
  site.about = { title: "", photo: "", line: "", ...(site.about || {}) };
  site.now = Array.isArray(site.now) ? site.now : [];
  const err = errorBox();
  const title = textInput(site, "title", { required: true, maxlength: 80 });

  const save = h("button", { type: "button", class: "btn btn-primary", onClick: () => busy(save, "Saving…", async () => {
    site.title = site.title.trim();
    if (!site.title) return err.show("Give the site a title.", title);
    err.clear();
    site.now = site.now.filter((r) => r.label?.trim() && r.value?.trim());
    await saveSite(site);
    ctx.data.site = site;
    ctx.setDirty(false);
    toast("Saved");
    drawNow();
  }) }, "Save changes");

  // "Right now" rows: label + value pairs.
  const nowList = h("div", { class: "now-rows" });
  function drawNow() {
    nowList.replaceChildren(
      ...site.now.map((row, i) => {
        const label = h("input", { class: "input", value: row.label || "", placeholder: "e.g. Studying", "aria-label": `Row ${i + 1} label` });
        const value = h("input", { class: "input", value: row.value || "", placeholder: "e.g. Organic chemistry", "aria-label": `Row ${i + 1} value` });
        label.addEventListener("input", () => (row.label = label.value));
        value.addEventListener("input", () => (row.value = value.value));
        return h("div", { class: "now-row" }, label, value,
          iconButton("remove", `Remove row ${i + 1}`, () => { site.now.splice(i, 1); ctx.setDirty(true); drawNow(); }));
      }),
      site.now.length < 8
        ? h("button", { type: "button", class: "btn btn-small", onClick: () => {
            site.now.push({ label: "", value: "" });
            ctx.setDirty(true);
            drawNow();
            nowList.querySelectorAll(".now-row input")[site.now.length * 2 - 2]?.focus();
          } }, "Add a row")
        : null,
    );
  }
  if (!site.now.length) site.now = [{ label: "Studying", value: "" }, { label: "Reading", value: "" }, { label: "Listening to", value: "" }];
  drawNow();

  return h("div", {},
    shell({
      title: "Site settings",
      intro: "Your site's name, the welcome note on the home page, and the boxes at the side.",
      form: [
        h("h2", { class: "form-section" }, "Header"),
        field("Site title", title),
        field("Tagline", textInput(site, "tagline", { maxlength: 90, placeholder: "e.g. trips, projects and ordinary days" }), "The handwritten line under the title. Optional."),

        h("h2", { class: "form-section" }, "Welcome note"),
        field("Heading", textInput(site, "welcomeTitle", { maxlength: 80, placeholder: "Welcome in" })),
        field("Message", textInput(site, "intro", { multiline: true, rows: 5 }), "Leave an empty line between paragraphs."),
        field("Your name", textInput(site, "author"), "Signs the note and appears in the footer."),

        h("h2", { class: "form-section" }, "About me box"),
        h("div", { class: "field" }, h("span", { class: "label" }, "Photo"),
          imagePicker(site.about.photo, (id) => { site.about.photo = id; ctx.setDirty(true); }, { label: "About me photo" }),
          h("p", { class: "hint" }, "Shown as a tilted print. Square photos work best.")),
        field("One line about you", textInput(site.about, "line", { maxlength: 120, placeholder: "e.g. JEE aspirant, Delhi, builds websites" })),
        field("Box title", textInput(site.about, "title", { maxlength: 30, placeholder: "About me" })),

        h("h2", { class: "form-section" }, "Right now box"),
        h("p", { class: "hint" }, "Rows with both parts filled in are shown. Leave them empty to hide the box."),
        nowList,
        err,
      ],
      actions: [save],
    }),
    h("section", { class: "card" },
      h("h2", {}, "Import from content/site.json"),
      h("p", { class: "muted" }, "Copies everything in the site.json file into the database. Useful once, when you first set up the panel. Items with the same web address are replaced."),
      h("button", { type: "button", class: "btn", onClick: (e) => importJson(ctx, e.currentTarget) }, "Import content/site.json")),
  );
}

/* ---------- delete helpers ---------- */

async function deleteSection(ctx, sec, button) {
  const subs = ctx.data.subsections.filter((s) => s.sectionId === sec.id);
  const subIds = new Set(subs.map((s) => s.id));
  const posts = ctx.data.posts.filter((p) => subIds.has(p.subsectionId));
  const extra = subs.length || posts.length ? ` and everything in it: ${subs.length} sub-section${subs.length === 1 ? "" : "s"} and ${posts.length} entr${posts.length === 1 ? "y" : "ies"}` : "";
  const ok = await confirmDialog({
    title: `Delete "${sec.title}"?`,
    message: `This deletes the section${extra}. Photos stay in Cloudinary. This can't be undone.`,
    confirmLabel: "Delete section", danger: true,
  });
  if (!ok) return;
  await busy(button, "Deleting…", async () => {
    await deleteMany([
      ...posts.map((p) => ({ collection: "posts", id: p.id })),
      ...subs.map((s) => ({ collection: "subsections", id: s.id })),
      { collection: "sections", id: sec.id },
    ]);
    const postIds = new Set(posts.map((p) => p.id));
    ctx.data.posts = ctx.data.posts.filter((p) => !postIds.has(p.id));
    ctx.data.subsections = ctx.data.subsections.filter((s) => !subIds.has(s.id));
    ctx.data.sections = ctx.data.sections.filter((s) => s.id !== sec.id);
    ctx.setDirty(false);
    toast("Section deleted");
    ctx.go("");
  });
}

async function deleteSub(ctx, sub, button) {
  const posts = ctx.data.posts.filter((p) => p.subsectionId === sub.id);
  const ok = await confirmDialog({
    title: `Delete "${sub.title}"?`,
    message: `This deletes the sub-section${posts.length ? ` and its ${posts.length} entr${posts.length === 1 ? "y" : "ies"}` : ""}. Photos stay in Cloudinary. This can't be undone.`,
    confirmLabel: "Delete sub-section", danger: true,
  });
  if (!ok) return;
  await busy(button, "Deleting…", async () => {
    await deleteMany([...posts.map((p) => ({ collection: "posts", id: p.id })), { collection: "subsections", id: sub.id }]);
    const postIds = new Set(posts.map((p) => p.id));
    ctx.data.posts = ctx.data.posts.filter((p) => !postIds.has(p.id));
    ctx.data.subsections = ctx.data.subsections.filter((s) => s.id !== sub.id);
    ctx.setDirty(false);
    toast("Sub-section deleted");
    ctx.go(`section/${sub.sectionId}`);
  });
}

/* ---------- section ---------- */

export function sectionEditor(ctx, existing) {
  const isNew = !existing;
  const item = clone(existing || { title: "", description: "", cover: "", order: nextOrder(ctx.data.sections) });
  const err = errorBox();
  const title = textInput(item, "title", { required: true, maxlength: 80 });

  const save = h("button", { type: "button", class: "btn btn-primary", onClick: () => busy(save, isNew ? "Creating…" : "Saving…", async () => {
    item.title = item.title.trim();
    if (!item.title) return err.show("Give the section a title.", title);
    err.clear();
    if (isNew) item.id = uniqueId(item.title, new Set(ctx.data.sections.map((s) => s.id)));
    await saveItem("sections", item);
    if (isNew) ctx.data.sections.push(item);
    else Object.assign(existing, item);
    ctx.setDirty(false);
    toast(isNew ? "Section created" : "Saved");
    if (isNew) ctx.go(`section/${item.id}`);
    else ctx.refreshTree();
  }) }, isNew ? "Create section" : "Save changes");

  const actions = [save];
  if (!isNew) {
    actions.push(
      h("a", { class: "btn", href: `#new/sub/${existing.id}` }, "Add a sub-section"),
      viewLink(`./#/s/${existing.id}`),
      h("span", { class: "spacer" }),
      h("span", { class: "order-tools" },
        iconButton("up", "Move section up", () => moveSection(-1)),
        iconButton("down", "Move section down", () => moveSection(1))),
      h("button", { type: "button", class: "btn btn-danger-quiet", onClick: (e) => deleteSection(ctx, existing, e.currentTarget) }, "Delete section"),
    );
  }

  async function moveSection(delta) {
    try {
      if (await reorder("sections", ctx.data.sections, existing, delta)) {
        item.order = existing.order;
        ctx.refreshTree();
        toast("Order saved");
      }
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }

  return shell({
    context: isNew ? null : h("span", {}, "Section"),
    title: isNew ? "New section" : existing.title,
    intro: isNew ? "Sections are the top level of your scrapbook, like Travel or Projects." : null,
    form: [
      field("Title", title),
      field("Description", textInput(item, "description", { multiline: true, rows: 2 }), "A sentence shown under the title."),
      h("div", { class: "field" }, h("span", { class: "label" }, "Cover photo"),
        imagePicker(item.cover, (id) => { item.cover = id; ctx.setDirty(true); }, { label: "Cover" }),
        h("p", { class: "hint" }, "Shown as a banner at the top of the section page.")),
      !isNew ? h("p", { class: "hint" }, `Web address: /#/s/${existing.id}`) : null,
      err,
    ],
    actions,
  });
}

/* ---------- sub-section ---------- */

export function subEditor(ctx, existing, sectionIdForNew) {
  const isNew = !existing;
  const sections = [...ctx.data.sections].sort(byOrder);
  if (!sections.length) {
    return shell({ title: "New sub-section", intro: "Create a section first. Sub-sections live inside sections.",
      actions: [h("a", { class: "btn btn-primary", href: "#new/section" }, "New section")] });
  }
  const item = clone(existing || {
    title: "", sectionId: sectionIdForNew || sections[0].id, description: "", cover: "",
    sort: "newest", order: nextOrder(ctx.data.subsections.filter((s) => s.sectionId === (sectionIdForNew || sections[0].id))),
  });
  const err = errorBox();
  const title = textInput(item, "title", { required: true, maxlength: 80 });

  const sectionSelect = h("select", { class: "input" }, sections.map((s) => h("option", { value: s.id, selected: s.id === item.sectionId }, s.title)));
  sectionSelect.addEventListener("change", () => {
    item.sectionId = sectionSelect.value;
    item.order = nextOrder(ctx.data.subsections.filter((s) => s.sectionId === item.sectionId && s.id !== item.id));
  });

  const sortSelect = h("select", { class: "input" },
    h("option", { value: "newest", selected: item.sort !== "oldest" }, "Newest first"),
    h("option", { value: "oldest", selected: item.sort === "oldest" }, "Oldest first (good for trips: day 1 at the top)"));
  sortSelect.addEventListener("change", () => (item.sort = sortSelect.value));

  const save = h("button", { type: "button", class: "btn btn-primary", onClick: () => busy(save, isNew ? "Creating…" : "Saving…", async () => {
    item.title = item.title.trim();
    if (!item.title) return err.show("Give the sub-section a title.", title);
    err.clear();
    if (isNew) item.id = uniqueId(item.title, new Set(ctx.data.subsections.map((s) => s.id)));
    await saveItem("subsections", item);
    if (isNew) ctx.data.subsections.push(item);
    else Object.assign(existing, item);
    ctx.setDirty(false);
    toast(isNew ? "Sub-section created" : "Saved");
    if (isNew) ctx.go(`sub/${item.id}`);
    else ctx.refreshTree();
  }) }, isNew ? "Create sub-section" : "Save changes");

  const actions = [save];
  if (!isNew) {
    actions.push(
      h("a", { class: "btn", href: `#new/post/${existing.id}` }, "Add an entry"),
      viewLink(`./#/s/${existing.sectionId}/${existing.id}`),
      h("span", { class: "spacer" }),
      h("span", { class: "order-tools" },
        iconButton("up", "Move sub-section up", () => moveSub(-1)),
        iconButton("down", "Move sub-section down", () => moveSub(1))),
      h("button", { type: "button", class: "btn btn-danger-quiet", onClick: (e) => deleteSub(ctx, existing, e.currentTarget) }, "Delete sub-section"),
    );
  }

  async function moveSub(delta) {
    try {
      const siblings = ctx.data.subsections.filter((s) => s.sectionId === existing.sectionId);
      if (await reorder("subsections", siblings, existing, delta)) {
        item.order = existing.order;
        ctx.refreshTree();
        toast("Order saved");
      }
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }

  const sectionTitle = sections.find((s) => s.id === item.sectionId)?.title;
  return shell({
    context: isNew ? null : `Sub-section in ${sectionTitle}`,
    title: isNew ? "New sub-section" : existing.title,
    intro: isNew ? "Sub-sections group entries inside a section, like one trip inside Travel." : null,
    form: [
      field("Title", title),
      field("Section", sectionSelect),
      field("Description", textInput(item, "description", { multiline: true, rows: 2 })),
      field("Order of entries", sortSelect),
      h("div", { class: "field" }, h("span", { class: "label" }, "Cover photo"),
        imagePicker(item.cover, (id) => { item.cover = id; ctx.setDirty(true); }, { label: "Cover" }),
        h("p", { class: "hint" }, "Optional. If empty, the newest entry's cover is used.")),
      !isNew ? h("p", { class: "hint" }, `Web address: /#/s/${item.sectionId}/${existing.id}`) : null,
      err,
    ],
    actions,
  });
}

/* ---------- entry ---------- */

export function postEditor(ctx, existing, subIdForNew) {
  const isNew = !existing;
  const sections = [...ctx.data.sections].sort(byOrder);
  const allSubs = ctx.data.subsections;
  if (!allSubs.length) {
    return shell({ title: "New entry", intro: "Entries live inside sub-sections. Create a section and a sub-section first.",
      actions: [h("a", { class: "btn btn-primary", href: sections.length ? `#new/sub/${sections[0].id}` : "#new/section" }, sections.length ? "New sub-section" : "New section")] });
  }

  const item = clone(existing || {
    title: "", subsectionId: subIdForNew || "", date: today(), location: "", excerpt: "", cover: "", draft: true, blocks: [{ type: "text", body: "" }],
  });
  item.blocks ||= [];
  const err = errorBox();
  const title = textInput(item, "title", { required: true, maxlength: 120 });

  const subSelect = h("select", { class: "input" },
    h("option", { value: "", disabled: true, selected: !item.subsectionId }, "Choose where this entry goes"),
    sections.map((sec) => {
      const subs = allSubs.filter((s) => s.sectionId === sec.id).sort(byOrder);
      return subs.length ? h("optgroup", { label: sec.title }, subs.map((s) => h("option", { value: s.id, selected: s.id === item.subsectionId }, s.title))) : null;
    }));
  subSelect.addEventListener("change", () => (item.subsectionId = subSelect.value));

  const date = textInput(item, "date", { type: "date" });

  async function persist(button, label, publish) {
    await busy(button, label, async () => {
      item.title = item.title.trim();
      if (!item.title) return err.show("Give the entry a title.", title);
      if (!item.subsectionId) return err.show("Choose a sub-section for this entry.", subSelect);
      err.clear();
      if (publish !== undefined) item.draft = !publish;
      item.draft = item.draft !== false;
      item.blocks = item.blocks.filter((b) => !(b.type === "text" && !b.body?.trim()) || item.blocks.length === 1);
      item.updatedAt = new Date().toISOString();
      item.updatedBy = ctx.username;
      if (isNew) item.id = uniqueId(item.title, new Set(ctx.data.posts.map((p) => p.id)));
      await saveItem("posts", item);
      if (isNew) ctx.data.posts.push(item);
      else Object.assign(existing, clone(item));
      ctx.setDirty(false);
      toast(publish === true ? "Published" : publish === false ? (isNew ? "Draft saved" : "Moved back to drafts") : item.draft ? "Draft saved" : "Saved");
      ctx.go(`post/${item.id}`);
    });
  }

  const actions = [];
  if (item.draft) {
    const saveDraft = h("button", { type: "button", class: "btn", onClick: () => persist(saveDraft, "Saving…", false) }, "Save draft");
    const publish = h("button", { type: "button", class: "btn btn-primary", onClick: () => persist(publish, "Publishing…", true) }, "Publish");
    actions.push(publish, saveDraft);
  } else {
    const save = h("button", { type: "button", class: "btn btn-primary", onClick: () => persist(save, "Saving…") }, "Save changes");
    const unpublish = h("button", { type: "button", class: "btn", onClick: () => persist(unpublish, "Saving…", false) }, "Unpublish");
    actions.push(save, unpublish);
  }
  if (!isNew && !existing.draft) actions.push(viewLink(`./#/p/${existing.id}`));
  if (!isNew) {
    actions.push(h("span", { class: "spacer" }), h("button", { type: "button", class: "btn btn-danger-quiet", onClick: async (e) => {
      const btn = e.currentTarget;
      const ok = await confirmDialog({ title: `Delete "${existing.title}"?`, message: "The entry is removed from the site. Photos stay in Cloudinary. This can't be undone.", confirmLabel: "Delete entry", danger: true });
      if (!ok) return;
      await busy(btn, "Deleting…", async () => {
        await deleteMany([{ collection: "posts", id: existing.id }]);
        ctx.data.posts = ctx.data.posts.filter((p) => p.id !== existing.id);
        ctx.setDirty(false);
        toast("Entry deleted");
        ctx.go(`sub/${existing.subsectionId}`);
      });
    } }, "Delete entry"));
  }

  const sub = allSubs.find((s) => s.id === item.subsectionId);
  const status = isNew ? null : h("span", { class: `badge ${item.draft ? "" : "badge-live"}` }, item.draft ? "Draft" : "Published");

  return shell({
    context: isNew ? null : sub ? `Entry in ${sub.title}` : "Entry",
    title: isNew ? "New entry" : existing.title,
    status,
    intro: isNew ? "Write it up, add photos or a video, then save it as a draft or publish it straight away." : null,
    form: [
      field("Title", title),
      h("div", { class: "grid-2" },
        field("Sub-section", subSelect),
        field("Date", date)),
      field("Place", textInput(item, "location", { placeholder: "Optional, e.g. Manali, Himachal Pradesh" })),
      field("Short summary", textInput(item, "excerpt", { multiline: true, rows: 2 }), "Shown in lists and under the title."),
      h("div", { class: "field" }, h("span", { class: "label" }, "Cover photo"),
        imagePicker(item.cover, (id) => { item.cover = id; ctx.setDirty(true); }, { label: "Cover" }),
        h("p", { class: "hint" }, "Shown at the top of the entry and in lists. Landscape photos work best.")),
      h("div", { class: "field" }, h("span", { class: "label" }, "Content"),
        blockEditor(item.blocks, () => ctx.setDirty(true))),
      !isNew ? h("p", { class: "hint" }, `Web address: /#/p/${existing.id}`) : null,
      err,
    ],
    actions,
  });
}

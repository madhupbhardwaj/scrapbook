// Admin panel: sign-in, layout, content tree and navigation.
// Routes (in the address bar after #):
//   (empty)            overview
//   site               site settings + import
//   admins             manage admins
//   section/<id>       sub-section/<id> → "sub/<id>"     post/<id>
//   new/section        new/sub/<sectionId>               new/post/<subId?>

import { CONFIG, firebaseConfigured } from "../config.js";
import { authentication, usernameToEmail, emailToUsername } from "../firebase.js";
import { h, ICONS, toast, confirmDialog, errorMessage } from "./ui.js";
import { loadAll, getAdmin } from "./store.js";
import { overview, siteEditor, sectionEditor, subEditor, postEditor } from "./editors.js";
import { adminsPage } from "./admins.js";

const app = document.getElementById("app");

const state = {
  user: null,
  username: "",
  data: null,
  dirty: false,
  expanded: new Set(),
};

let loginMessage = "";
let currentHash = location.hash;
let ignoreHash = false;
let auth, au;

/* ---------- boot & sign-in ---------- */

async function boot() {
  if (!firebaseConfigured()) {
    renderNotice("Connect Firebase first",
      "Fill in the firebase settings in js/config.js, push the change, then reload this page. The README walks through it step by step.");
    return;
  }
  try {
    ({ au, auth } = await authentication());
  } catch (err) {
    renderNotice("Couldn't load the sign-in system", `${errorMessage(err)} Check your connection and reload.`);
    return;
  }

  au.onAuthStateChanged(auth, async (user) => {
    if (!user) {
      state.user = null;
      renderLogin();
      return;
    }
    let admin = null;
    try {
      admin = await getAdmin(user.uid);
    } catch (err) {
      loginMessage = err?.code === "permission-denied"
        ? "Signed in, but the database refused access. Publish the rules from firestore.rules in the Firebase console."
        : errorMessage(err);
      await au.signOut(auth);
      return;
    }
    if (!admin) {
      loginMessage = "This account isn't on the admin list.";
      await au.signOut(auth);
      return;
    }
    state.user = user;
    state.username = admin.username || emailToUsername(user.email);
    try {
      state.data = await loadAll();
    } catch (err) {
      renderNotice("Couldn't load your content", errorMessage(err));
      return;
    }
    renderApp();
  });
}

function renderNotice(title, message) {
  app.replaceChildren(h("main", { class: "login" },
    h("div", { class: "login-card" },
      h("p", { class: "login-brand" }, "Scrapbook admin"),
      h("h1", {}, title),
      h("p", { class: "muted" }, message),
      h("a", { class: "btn", href: "./" }, "Go to the site"))));
}

function renderLogin() {
  const message = loginMessage;
  loginMessage = "";
  const user = h("input", { class: "input", id: "login-user", name: "username", autocomplete: "username", autocapitalize: "none", spellcheck: "false", required: true });
  const pass = h("input", { class: "input", id: "login-pass", name: "password", type: "password", autocomplete: "current-password", required: true });
  const error = h("p", { class: "error-text", role: "alert" }, message);
  const submit = h("button", { type: "submit", class: "btn btn-primary btn-block" }, "Sign in");

  const form = h("form", { class: "login-form", novalidate: true },
    h("div", { class: "field" }, h("label", { for: "login-user" }, "Username"), user),
    h("div", { class: "field" }, h("label", { for: "login-pass" }, "Password"), pass),
    error,
    submit,
  );

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = user.value.trim().toLowerCase();
    if (!username || !pass.value) {
      error.textContent = "Enter your username and password.";
      (username ? pass : user).focus();
      return;
    }
    if (!/^[a-z0-9._-]{2,32}$/.test(username)) {
      error.textContent = "Usernames use only letters, numbers, dots, dashes or underscores.";
      user.focus();
      return;
    }
    submit.disabled = true;
    submit.textContent = "Signing in…";
    error.textContent = "";
    try {
      await au.signInWithEmailAndPassword(auth, usernameToEmail(username), pass.value);
      // onAuthStateChanged takes it from here.
    } catch (err) {
      error.textContent = errorMessage(err);
      submit.disabled = false;
      submit.textContent = "Sign in";
      pass.select();
    }
  });

  app.replaceChildren(h("main", { class: "login" },
    h("div", { class: "login-card" },
      h("p", { class: "login-brand" }, "Scrapbook admin"),
      h("h1", {}, "Sign in"),
      form,
      h("a", { class: "login-back", href: "./" }, "Back to the site"))));
  user.focus();
}

async function signOut() {
  if (state.dirty && !(await confirmDiscard())) return;
  state.dirty = false;
  await au.signOut(auth);
  history.replaceState(null, "", location.pathname);
}

/* ---------- app shell ---------- */

let treeEl, mainEl, statusEl;

function renderApp() {
  treeEl = h("nav", { class: "a-tree", id: "a-tree", "aria-label": "Content" });
  mainEl = h("main", { class: "a-main", id: "a-main", tabindex: "-1" });
  statusEl = h("span", { class: "unsaved", hidden: true }, "Unsaved changes");
  mainEl.addEventListener("input", onEdit);
  mainEl.addEventListener("change", onEdit);

  const menuBtn = h("button", { type: "button", class: "icon-btn a-menu", "aria-controls": "a-tree", "aria-expanded": "false", "aria-label": "Show content list",
    html: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    onClick: () => setDrawer(!document.body.classList.contains("drawer-open")) });

  app.replaceChildren(
    h("header", { class: "a-top" },
      menuBtn,
      h("a", { class: "a-brand", href: "#" }, h("span", {}, state.data.site.title || "Scrapbook"), h("span", { class: "a-brand-sub" }, "Admin")),
      statusEl,
      h("a", { class: "btn btn-small btn-quiet a-view", href: "./", target: "_blank", rel: "noopener" }, "View site"),
      h("span", { class: "a-user" }, state.username),
      h("button", { type: "button", class: "btn btn-small", onClick: signOut }, "Sign out"),
    ),
    h("div", { class: "a-shell" }, treeEl, h("div", { class: "a-scrim", onClick: () => setDrawer(false) }), mainEl),
  );
  route();
}

function setDrawer(open) {
  document.body.classList.toggle("drawer-open", open);
  document.querySelector(".a-menu")?.setAttribute("aria-expanded", String(open));
}

/* ---------- unsaved changes ---------- */

function setDirty(value) {
  state.dirty = value;
  if (statusEl) statusEl.hidden = !value;
}

function confirmDiscard() {
  return confirmDialog({ title: "Discard unsaved changes?", message: "You've made changes on this page that haven't been saved.", confirmLabel: "Discard changes", danger: true });
}

window.addEventListener("beforeunload", (e) => {
  if (state.dirty) {
    e.preventDefault();
    e.returnValue = "";
  }
});

window.addEventListener("hashchange", async () => {
  if (!state.user) return;
  if (ignoreHash) { ignoreHash = false; return; }
  if (state.dirty && !(await confirmDiscard())) {
    ignoreHash = true;
    location.hash = currentHash;
    return;
  }
  route();
});

/* ---------- routing ---------- */

function go(hash) {
  setDirty(false);
  if (location.hash === `#${hash}` || (location.hash === "" && hash === "")) route();
  else location.hash = hash;
}

function route() {
  setDirty(false);
  setDrawer(false);
  currentHash = location.hash;
  const parts = location.hash.replace(/^#/, "").split("/").filter(Boolean).map(decodeURIComponent);
  const d = state.data;
  const ctx = makeCtx();
  let view;

  const [a, b, c] = parts;
  if (!a) view = overview(ctx);
  else if (a === "site") view = siteEditor(ctx);
  else if (a === "admins") view = adminsPage(ctx);
  else if (a === "section") view = d.sections.find((s) => s.id === b) && sectionEditor(ctx, d.sections.find((s) => s.id === b));
  else if (a === "sub") view = d.subsections.find((s) => s.id === b) && subEditor(ctx, d.subsections.find((s) => s.id === b));
  else if (a === "post") view = d.posts.find((p) => p.id === b) && postEditor(ctx, d.posts.find((p) => p.id === b));
  else if (a === "new" && b === "section") view = sectionEditor(ctx, null);
  else if (a === "new" && b === "sub") view = subEditor(ctx, null, c);
  else if (a === "new" && b === "post") view = postEditor(ctx, null, c);

  if (!view) {
    view = h("div", { class: "ed" },
      h("h1", { class: "ed-title" }, "Not found"),
      h("p", { class: "muted" }, "This item doesn't exist. It may have been deleted."),
      h("a", { class: "btn", href: "#" }, "Go to the overview"));
  }

  // Keep the relevant sub-section open in the tree.
  if (a === "sub" && b) state.expanded.add(b);
  if (a === "new" && b === "post" && c) state.expanded.add(c);
  if (a === "post") {
    const p = d.posts.find((x) => x.id === b);
    if (p) state.expanded.add(p.subsectionId);
  }

  mainEl.replaceChildren(view);
  renderTree();
  mainEl.scrollTop = 0;
  window.scrollTo(0, 0);
  mainEl.focus({ preventScroll: true });
}

// Any typing inside an editor form marks the page unsaved (except fields marked data-no-dirty).
function onEdit(e) {
  if (e.target.closest("[data-no-dirty]")) return;
  if (e.target.closest(".ed-form")) setDirty(true);
}

function makeCtx() {
  return {
    data: state.data,
    username: state.username,
    user: state.user,
    au, auth,
    go,
    setDirty,
    refreshTree: renderTree,
    reload: async () => {
      state.data = await loadAll();
      renderApp();
    },
  };
}

/* ---------- content tree ---------- */

function renderTree() {
  const d = state.data;
  const here = location.hash || "#";
  const link = (href, label, extra = {}) =>
    h("a", { href, class: extra.class || "", "aria-current": here === href ? "page" : null }, label, extra.after || null);

  const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.title).localeCompare(String(b.title));
  const sections = [...d.sections].sort(byOrder);

  const tree = h("ul", { class: "t-list" }, sections.map((sec) => {
    const subs = d.subsections.filter((s) => s.sectionId === sec.id).sort(byOrder);
    return h("li", { class: "t-sec" },
      link(`#section/${sec.id}`, sec.title || "Untitled section", { class: "t-sec-link" }),
      h("ul", {},
        subs.map((sub) => {
          const posts = d.posts.filter((p) => p.subsectionId === sub.id).sort((x, y) => String(y.date || "").localeCompare(String(x.date || "")));
          const open = state.expanded.has(sub.id);
          const toggle = h("button", { type: "button", class: "t-toggle", "aria-expanded": String(open), "aria-label": `${open ? "Hide" : "Show"} entries in ${sub.title}`, html: ICONS.chevron,
            onClick: () => { open ? state.expanded.delete(sub.id) : state.expanded.add(sub.id); renderTree(); } });
          return h("li", { class: "t-sub" },
            h("div", { class: "t-sub-row" }, toggle,
              link(`#sub/${sub.id}`, sub.title || "Untitled", { class: "t-sub-link", after: h("span", { class: "t-count" }, String(posts.length)) })),
            open ? h("ul", { class: "t-posts" },
              posts.map((p) => h("li", {}, link(`#post/${p.id}`, p.title || "Untitled entry", { class: "t-post-link", after: p.draft ? h("span", { class: "badge" }, "Draft") : null }))),
              h("li", {}, h("a", { class: "t-add", href: `#new/post/${sub.id}` }, "New entry"))) : null,
          );
        }),
        h("li", {}, h("a", { class: "t-add", href: `#new/sub/${sec.id}` }, "New sub-section")),
      ),
    );
  }));

  treeEl.replaceChildren(
    h("div", { class: "t-top" },
      link("#", "Overview"),
      link("#site", "Site settings"),
      link("#admins", "Admins"),
    ),
    h("div", { class: "t-head" },
      h("h2", {}, "Sections"),
      h("a", { class: "btn btn-small", href: "#new/section" }, "New section")),
    sections.length ? tree : h("p", { class: "t-empty muted" }, "No sections yet."),
  );
}

boot();

export { state, CONFIG };

// Small DOM helpers shared by the admin panel.

const PROPS = new Set(["value", "checked", "disabled", "selected", "hidden", "multiple", "required", "readOnly", "indeterminate"]);

// h("button", { class: "btn", onClick: fn }, "Label", childNode, [moreChildren])
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, val] of Object.entries(props || {})) {
    if (val == null || val === false) continue;
    if (key === "class") el.className = val;
    else if (key === "dataset") Object.assign(el.dataset, val);
    else if (key === "style" && typeof val === "object") Object.assign(el.style, val);
    else if (key === "html") el.innerHTML = val;
    else if (key.startsWith("on") && typeof val === "function") el.addEventListener(key.slice(2).toLowerCase(), val);
    else if (PROPS.has(key)) el[key] = val;
    else el.setAttribute(key, val === true ? "" : val);
  }
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : String(child));
  }
  return el;
}

export const ICONS = {
  up: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 14l6-6 6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  down: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 10l6 6 6-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  left: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M14 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  right: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M10 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  remove: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  close: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  plus: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  image: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3.5" y="5" width="17" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="9" cy="10" r="1.6" fill="currentColor"/><path d="M4 17l5-5 4 4 3-3 4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  back: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

export function iconButton(icon, label, onClick, extra = {}) {
  return h("button", { type: "button", class: `icon-btn ${extra.class || ""}`.trim(), "aria-label": label, title: label, onClick, html: ICONS[icon], disabled: extra.disabled });
}

// Labelled form field. `control` is an input/select/textarea element.
let fieldId = 0;
export function field(label, control, hint) {
  const id = control.id || `f${++fieldId}`;
  control.id = id;
  const hintEl = hint ? h("p", { class: "hint", id: `${id}-hint` }, hint) : null;
  if (hintEl) control.setAttribute("aria-describedby", hintEl.id);
  return h("div", { class: "field" }, h("label", { for: id }, label), control, hintEl);
}

export function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "item";
}

export function uniqueId(base, taken) {
  let id = slugify(base);
  if (!taken.has(id)) return id;
  let n = 2;
  while (taken.has(`${id}-${n}`)) n++;
  return `${id}-${n}`;
}

/* ---------- toast ---------- */

let toastEl, toastTimer;
export function toast(message, kind = "ok") {
  if (!toastEl) {
    toastEl = h("div", { class: "toast", role: "status", "aria-live": "polite" });
    document.body.append(toastEl);
  }
  toastEl.textContent = message;
  toastEl.dataset.kind = kind;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), kind === "error" ? 6000 : 2800);
}

/* ---------- confirm dialog ---------- */

export function confirmDialog({ title, message, confirmLabel = "Confirm", danger = false }) {
  return new Promise((resolve) => {
    const dlg = h("dialog", { class: "modal", "aria-labelledby": "modal-title" },
      h("h2", { id: "modal-title" }, title),
      message ? h("p", {}, message) : null,
      h("div", { class: "modal-actions" },
        h("button", { type: "button", class: "btn", value: "cancel", onClick: () => dlg.close("cancel") }, "Cancel"),
        h("button", { type: "button", class: `btn ${danger ? "btn-danger" : "btn-primary"}`, onClick: () => dlg.close("ok") }, confirmLabel),
      ),
    );
    dlg.addEventListener("close", () => {
      resolve(dlg.returnValue === "ok");
      dlg.remove();
    });
    document.body.append(dlg);
    dlg.showModal();
    dlg.querySelector(".modal-actions .btn").focus();
  });
}

// Friendly text for Firebase errors.
export function errorMessage(err) {
  const code = err?.code || "";
  const map = {
    "auth/invalid-credential": "Username or password is incorrect.",
    "auth/invalid-login-credentials": "Username or password is incorrect.",
    "auth/wrong-password": "Username or password is incorrect.",
    "auth/user-not-found": "Username or password is incorrect.",
    "auth/invalid-email": "That username can't be used. Use letters, numbers, dots, dashes or underscores.",
    "auth/too-many-requests": "Too many attempts. Wait a few minutes and try again.",
    "auth/network-request-failed": "Couldn't reach the server. Check your connection and try again.",
    "auth/email-already-in-use": "That username is already taken.",
    "auth/weak-password": "Password is too short. Use at least 8 characters.",
    "auth/requires-recent-login": "For security, sign out and sign in again, then retry.",
    "auth/operation-not-allowed": "Username and password sign-in isn't turned on in Firebase yet. See the README.",
    "permission-denied": "You don't have permission to do that. Check that your account is in the admins list.",
    unavailable: "Couldn't reach the database. Check your connection and try again.",
  };
  return map[code] || err?.message || "Something went wrong.";
}

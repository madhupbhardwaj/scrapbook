// Manage who can sign in to the panel, and change your own password.

import { CONFIG } from "../config.js";
import { authentication, usernameToEmail } from "../firebase.js";
import { h, field, toast, confirmDialog, errorMessage } from "./ui.js";
import { listAdmins, addAdminRecord, removeAdminRecord } from "./store.js";

const USERNAME = /^[a-z0-9._-]{2,32}$/;

function passwordInput(autocomplete) {
  return h("input", { class: "input", type: "password", autocomplete, minlength: "8", "data-no-dirty": "" });
}

export function adminsPage(ctx) {
  const listEl = h("ul", { class: "admin-list" }, h("li", { class: "muted" }, "Loading…"));

  async function drawList() {
    try {
      const admins = await listAdmins();
      listEl.replaceChildren(...admins.map((a) =>
        h("li", {},
          h("span", { class: "admin-name" }, a.username || "(no username)", a.uid === ctx.user.uid ? h("span", { class: "badge" }, "You") : null),
          a.uid === ctx.user.uid ? null : h("button", { type: "button", class: "btn btn-small btn-danger-quiet", onClick: async (e) => {
            const ok = await confirmDialog({
              title: `Remove ${a.username} as an admin?`,
              message: "They won't be able to sign in to this panel any more. You can add them again later.",
              confirmLabel: "Remove admin", danger: true,
            });
            if (!ok) return;
            e.currentTarget.disabled = true;
            try {
              await removeAdminRecord(a.uid);
              toast(`${a.username} removed`);
              drawList();
            } catch (err) {
              toast(errorMessage(err), "error");
              e.currentTarget.disabled = false;
            }
          } }, "Remove"))));
    } catch (err) {
      listEl.replaceChildren(h("li", { class: "error-text" }, errorMessage(err)));
    }
  }
  drawList();

  return h("div", { class: "ed" },
    h("div", { class: "ed-head" },
      h("h1", { class: "ed-title" }, "Admins"),
      h("p", { class: "ed-intro muted" }, "People who can sign in here and change the site.")),
    h("section", { class: "card" }, h("h2", {}, "Current admins"), listEl),
    addAdminForm(ctx, drawList),
    changePasswordForm(ctx),
  );
}

function addAdminForm(ctx, onAdded) {
  const user = h("input", { class: "input", autocomplete: "off", autocapitalize: "none", spellcheck: "false", "data-no-dirty": "" });
  const pass = passwordInput("new-password");
  const error = h("p", { class: "error-text", role: "alert" });
  const submit = h("button", { type: "submit", class: "btn btn-primary" }, "Add admin");

  const form = h("form", { class: "card", novalidate: true, "data-no-dirty": "" },
    h("h2", {}, "Add an admin"),
    h("p", { class: "muted" }, "Choose their username and a starting password, then share both with them. They can change the password after signing in."),
    h("div", { class: "grid-2" },
      field("Username", user, "Letters, numbers, dots, dashes or underscores."),
      field("Password", pass, "At least 8 characters.")),
    error, submit);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = user.value.trim().toLowerCase();
    if (!USERNAME.test(username)) { error.textContent = "Use 2–32 letters, numbers, dots, dashes or underscores for the username."; user.focus(); return; }
    if (pass.value.length < 8) { error.textContent = "Use at least 8 characters for the password."; pass.focus(); return; }
    error.textContent = "";
    submit.disabled = true;
    submit.textContent = "Adding…";

    // Create the login on a separate Firebase app instance so you stay signed in as yourself.
    const { au, appMod } = await authentication();
    const temp = appMod.initializeApp(CONFIG.firebase, `add-admin-${Date.now()}`);
    try {
      const tempAuth = au.getAuth(temp);
      const cred = await au.createUserWithEmailAndPassword(tempAuth, usernameToEmail(username), pass.value);
      await addAdminRecord(cred.user.uid, { username, addedBy: ctx.username, addedAt: new Date().toISOString() });
      await au.signOut(tempAuth);
      toast(`${username} can now sign in`);
      user.value = "";
      pass.value = "";
      onAdded();
    } catch (err) {
      error.textContent = errorMessage(err);
    } finally {
      appMod.deleteApp(temp).catch(() => {});
      submit.disabled = false;
      submit.textContent = "Add admin";
    }
  });
  return form;
}

function changePasswordForm(ctx) {
  const current = passwordInput("current-password");
  const next = passwordInput("new-password");
  const error = h("p", { class: "error-text", role: "alert" });
  const submit = h("button", { type: "submit", class: "btn" }, "Change password");

  const form = h("form", { class: "card", novalidate: true, "data-no-dirty": "" },
    h("h2", {}, "Change your password"),
    h("div", { class: "grid-2" }, field("Current password", current), field("New password", next, "At least 8 characters.")),
    error, submit);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!current.value) { error.textContent = "Enter your current password."; current.focus(); return; }
    if (next.value.length < 8) { error.textContent = "Use at least 8 characters for the new password."; next.focus(); return; }
    error.textContent = "";
    submit.disabled = true;
    submit.textContent = "Changing…";
    try {
      const { au } = await authentication();
      const credential = au.EmailAuthProvider.credential(ctx.user.email, current.value);
      await au.reauthenticateWithCredential(ctx.user, credential);
      await au.updatePassword(ctx.user, next.value);
      current.value = "";
      next.value = "";
      toast("Password changed");
    } catch (err) {
      error.textContent = errorMessage(err);
    } finally {
      submit.disabled = false;
      submit.textContent = "Change password";
    }
  });
  return form;
}

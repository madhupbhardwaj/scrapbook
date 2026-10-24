// Loads the Firebase SDK only when it's needed (straight from Google's CDN, no build step).
// The public site uses only Firestore; the admin panel also loads Authentication.

import { CONFIG } from "./config.js";

const SDK = "https://www.gstatic.com/firebasejs/10.12.2";

let appPromise, dbPromise, authPromise;

function loadApp() {
  appPromise ||= import(`${SDK}/firebase-app.js`).then((mod) => ({
    mod,
    app: mod.initializeApp(CONFIG.firebase),
  }));
  return appPromise;
}

// → { fs: <firestore module>, db }
export function firestore() {
  dbPromise ||= Promise.all([loadApp(), import(`${SDK}/firebase-firestore.js`)]).then(([a, fs]) => ({
    fs,
    db: fs.getFirestore(a.app),
  }));
  return dbPromise;
}

// → { au: <auth module>, auth, appMod: <app module> }
export function authentication() {
  authPromise ||= Promise.all([loadApp(), import(`${SDK}/firebase-auth.js`)]).then(([a, au]) => ({
    au,
    auth: au.getAuth(a.app),
    appMod: a.mod,
  }));
  return authPromise;
}

export const usernameToEmail = (username) => `${String(username).trim().toLowerCase()}@${CONFIG.adminEmailDomain}`;
export const emailToUsername = (email = "") => String(email).split("@")[0];

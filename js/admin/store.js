// Reading and writing content in Firestore for the admin panel.

import { firestore } from "../firebase.js";

const COLLECTIONS = ["sections", "subsections", "posts"];

// Firestore rejects `undefined`; this also deep-copies.
const clean = (obj) => JSON.parse(JSON.stringify(obj));

function withoutId(item) {
  const { id, ...rest } = item;
  return rest;
}

export async function loadAll() {
  const { fs, db } = await firestore();
  const [site, ...lists] = await Promise.all([
    fs.getDoc(fs.doc(db, "site", "settings")),
    ...COLLECTIONS.map((c) => fs.getDocs(fs.collection(db, c))),
  ]);
  const [sections, subsections, posts] = lists.map((snap) => snap.docs.map((d) => ({ ...d.data(), id: d.id })));
  return {
    site: site.exists() ? site.data() : { title: "", intro: "", author: "" },
    sections,
    subsections,
    posts,
  };
}

export async function saveSite(site) {
  const { fs, db } = await firestore();
  await fs.setDoc(fs.doc(db, "site", "settings"), clean(site));
}

// collection: "sections" | "subsections" | "posts"
export async function saveItem(collection, item) {
  const { fs, db } = await firestore();
  await fs.setDoc(fs.doc(db, collection, item.id), clean(withoutId(item)));
}

// writes: [{ collection, item }] — saved together (all or nothing, in chunks of 400)
export async function saveMany(writes) {
  const { fs, db } = await firestore();
  for (let i = 0; i < writes.length; i += 400) {
    const batch = fs.writeBatch(db);
    for (const { collection, item } of writes.slice(i, i + 400)) {
      batch.set(fs.doc(db, collection, item.id), clean(withoutId(item)));
    }
    await batch.commit();
  }
}

// refs: [{ collection, id }]
export async function deleteMany(refs) {
  const { fs, db } = await firestore();
  for (let i = 0; i < refs.length; i += 400) {
    const batch = fs.writeBatch(db);
    for (const { collection, id } of refs.slice(i, i + 400)) batch.delete(fs.doc(db, collection, id));
    await batch.commit();
  }
}

/* ---------- admins ---------- */

export async function getAdmin(uid) {
  const { fs, db } = await firestore();
  const snap = await fs.getDoc(fs.doc(db, "admins", uid));
  return snap.exists() ? { ...snap.data(), uid } : null;
}

export async function listAdmins() {
  const { fs, db } = await firestore();
  const snap = await fs.getDocs(fs.collection(db, "admins"));
  return snap.docs.map((d) => ({ ...d.data(), uid: d.id })).sort((a, b) => String(a.username).localeCompare(String(b.username)));
}

export async function addAdminRecord(uid, data) {
  const { fs, db } = await firestore();
  await fs.setDoc(fs.doc(db, "admins", uid), clean(data));
}

export async function removeAdminRecord(uid) {
  const { fs, db } = await firestore();
  await fs.deleteDoc(fs.doc(db, "admins", uid));
}

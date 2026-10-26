// Content loading for the public site. Everything else only ever calls loadContent().
//
// Shape returned (identical for the JSON file and the database):
// {
//   site:        { title, intro, author },
//   sections:    [{ id, title, description, cover, order }],
//   subsections: [{ id, sectionId, title, description, cover, order, sort }],
//   posts:       [{ id, subsectionId, title, date, location, excerpt, cover, draft, blocks: [...] }]
// }
// In Firestore: one "site/settings" document plus "sections", "subsections" and "posts" collections,
// where each document's ID is the item's id.

import { CONFIG, firebaseConfigured } from "./config.js";
import { firestore } from "./firebase.js";

export async function loadContent() {
  const source = CONFIG.contentSource;
  if (source === "json") return loadFromJson();
  if (source === "firestore") return loadFromFirestore();

  // "auto": once the database is set up it is the only source. If it can't be reached
  // (daily free limit used up, outage, no connection) the site shows a "back soon" note
  // rather than the sample content in content/site.json.
  if (!firebaseConfigured()) return loadFromJson();
  try {
    return await withTimeout(loadFromFirestore(), 12000);
  } catch (err) {
    console.warn("Couldn't read the database.", err);
    throw unavailable(err);
  }
}

// Marks an error as "the content is temporarily unreachable" so the page can say so kindly.
function unavailable(cause) {
  const err = new Error("The content is temporarily unavailable.");
  err.unavailable = true;
  err.cause = cause;
  return err;
}

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`No reply from the database after ${ms / 1000}s.`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function loadFromJson() {
  const res = await fetch(CONFIG.contentUrl, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Couldn't load ${CONFIG.contentUrl} (HTTP ${res.status}).`);
  return normalise(await res.json());
}

async function loadFromFirestore() {
  const { fs, db } = await firestore();
  const [site, sections, subsections, posts] = await Promise.all([
    fs.getDoc(fs.doc(db, "site", "settings")),
    fs.getDocs(fs.collection(db, "sections")),
    fs.getDocs(fs.collection(db, "subsections")),
    fs.getDocs(fs.query(fs.collection(db, "posts"), fs.where("draft", "==", false))),
  ]);
  const list = (snap) => snap.docs.map((d) => ({ ...d.data(), id: d.id }));
  return normalise({
    site: site.exists() ? site.data() : {},
    sections: list(sections),
    subsections: list(subsections),
    posts: list(posts),
  });
}

function normalise(d = {}) {
  return {
    site: { title: "Scrapbook", intro: "", author: "", ...(d.site || {}) },
    sections: Array.isArray(d.sections) ? d.sections : [],
    subsections: Array.isArray(d.subsections) ? d.subsections : [],
    posts: Array.isArray(d.posts) ? d.posts : [],
  };
}

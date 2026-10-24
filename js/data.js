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

  // "auto": use the database once it's set up and has content.
  if (firebaseConfigured()) {
    try {
      const data = await loadFromFirestore();
      if (data.sections.length) return data;
    } catch (err) {
      console.warn("Couldn't read the database, showing content/site.json instead.", err);
    }
  }
  return loadFromJson();
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

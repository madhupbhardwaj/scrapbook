// Content loading. Everything else in the site only ever calls loadContent(),
// so switching from the JSON file to Firestore later means changing this file alone.
//
// Shape returned (and the shape the upload panel will write):
// {
//   site:        { title, intro, author },
//   sections:    [{ id, title, description, cover, order }],
//   subsections: [{ id, sectionId, title, description, cover, order, sort }],
//   posts:       [{ id, subsectionId, title, date, location, excerpt, cover, draft, blocks: [...] }]
// }
// In Firestore these become three collections (sections, subsections, posts) plus one "site" doc.

import { CONFIG } from "./config.js";

export async function loadContent() {
  switch (CONFIG.contentSource) {
    case "json":
      return loadFromJson(CONFIG.contentUrl);
    // case "firestore":
    //   return loadFromFirestore();   // added with the upload panel
    default:
      throw new Error(`Unknown content source "${CONFIG.contentSource}" in js/config.js`);
  }
}

async function loadFromJson(url) {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Couldn't load ${url} (HTTP ${res.status}).`);
  return normalise(await res.json());
}

function normalise(d = {}) {
  return {
    site: { title: "Scrapbook", intro: "", author: "", ...(d.site || {}) },
    sections: Array.isArray(d.sections) ? d.sections : [],
    subsections: Array.isArray(d.subsections) ? d.subsections : [],
    posts: Array.isArray(d.posts) ? d.posts : [],
  };
}

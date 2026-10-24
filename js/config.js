// Site-wide settings. This is the only file you need to edit to connect your accounts.

export const CONFIG = {
  // Your Cloudinary "cloud name" (Cloudinary dashboard, top-left).
  // Image "src" values that are not full URLs are treated as Cloudinary public IDs.
  cloudinaryCloudName: "jrkrafmm",

  // Where the content comes from.
  // "json"      → content/site.json (what you use now)
  // "firestore" → reserved for the upload panel we build next; data.js has the hook.
  contentSource: "json",
  contentUrl: "content/site.json",
};

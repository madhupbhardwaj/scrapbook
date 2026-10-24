// Site-wide settings. This is the only file you need to edit to connect your accounts.
// None of these values are secret: they are safe to have in a public website.

export const CONFIG = {
  // ---- Cloudinary (photos) ----
  // Cloud name: Cloudinary console → Home → Dashboard.
  cloudinaryCloudName: "jrkrafmm",
  // Name of an *unsigned* upload preset: Cloudinary → Settings → Upload → Upload presets.
  // Needed only by the admin panel, to upload photos.
  cloudinaryUploadPreset: "scrapbook",

  // ---- Firebase (database + admin logins) ----
  // Paste the firebaseConfig object from: Firebase console → Project settings → Your apps → Web app.
  firebase: {
    apiKey: "AIzaSyAzFNwnAYAA-6KYJoogFQbMSbHIliAyaNQ",
    authDomain: "scrapbook-transfer.firebaseapp.com",
    projectId: "scrapbook-transfer",
    storageBucket: "scrapbook-transfer.firebasestorage.app",
    messagingSenderId: "738471166350",
    appId: "1:738471166350:web:8a9d9a34871137c15864df",
  },

  // Admin usernames are turned into logins of the form  <username>@<adminEmailDomain>.
  // Example: username "madhup" → madhup@scrapbook.local  (no email is ever sent there).
  adminEmailDomain: "scrapbook.local",

  // ---- Where the public site reads content from ----
  // "auto"      → the database once Firebase is set up and has content, otherwise content/site.json
  // "firestore" → always the database
  // "json"      → always content/site.json
  contentSource: "auto",
  contentUrl: "content/site.json",
};

export const firebaseConfigured = () =>
  !!CONFIG.firebase?.apiKey && !CONFIG.firebase.apiKey.startsWith("YOUR_") && !!CONFIG.firebase.projectId;

export const uploadsConfigured = () =>
  !!CONFIG.cloudinaryCloudName && !CONFIG.cloudinaryCloudName.startsWith("YOUR_") &&
  !!CONFIG.cloudinaryUploadPreset && !CONFIG.cloudinaryUploadPreset.startsWith("YOUR_");

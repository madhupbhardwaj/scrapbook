# Scrapbook

A personal scrapbook and blog. Content is organised as **sections → sub-sections → entries**, and each entry mixes text, photos, galleries, quotes and video. An admin panel at `/admin` lets approved people add and edit everything without touching code.

Plain HTML, CSS and JavaScript. No build step.

```
index.html            the public site
admin.html            the admin panel (yoursite.vercel.app/admin)
css/styles.css        public site styling; colours and fonts are tokens at the top
css/admin.css         admin panel styling
js/config.js          ← the only file you edit: Cloudinary + Firebase settings
js/app.js             public pages, navigation, sidebar
js/data.js            loads content (database, or content/site.json as a fallback)
js/firebase.js        loads Firebase from Google's CDN
js/media.js           Cloudinary image/video URLs, YouTube links
js/lightbox.js        full-screen photo viewer
js/markdown.js        formatting inside text blocks
js/admin/             admin panel code
content/site.json     starter content, imported into the database once
firestore.rules       database security rules, pasted into Firebase
vercel.json           makes /admin work without .html
```

---

## Admin panel setup (one time, about 15 minutes)

### 1. Create a Firebase project

1. Go to console.firebase.google.com → **Create a project**. Name it e.g. `scrapbook`. Google Analytics isn't needed.
2. On the project home page, click the **Web** icon (`</>`) to add a web app. Any nickname. Don't tick Firebase Hosting.
3. Firebase shows a `firebaseConfig` block. Copy its values into the `firebase:` section of `js/config.js`:

```js
firebase: {
  apiKey: "AIza…",
  authDomain: "scrapbook-xxxx.firebaseapp.com",
  projectId: "scrapbook-xxxx",
  storageBucket: "scrapbook-xxxx.appspot.com",
  messagingSenderId: "123…",
  appId: "1:123…:web:…",
},
```

These values are meant to be public. Security comes from the rules in step 3, not from hiding them.

### 2. Turn on username/password sign-in

**Build → Authentication → Get started → Sign-in method → Email/Password → Enable → Save.**

The panel uses usernames. Behind the scenes, username `madhup` becomes the login `madhup@scrapbook.local`. No email is ever sent there.

### 3. Create the database and lock it down

1. **Build → Firestore Database → Create database.** Choose a location near you (e.g. `asia-south2` Delhi or `asia-south1` Mumbai) and **production mode**.
2. Open the **Rules** tab, replace everything with the contents of `firestore.rules`, and click **Publish**.

With these rules, anyone can read published entries, and only admins can see drafts or change anything.

### 4. Make yourself the first admin

This is done once by hand. After that, you add other admins from inside the panel.

1. **Authentication → Users → Add user.**
   - Email: `yourusername@scrapbook.local` (e.g. `madhup@scrapbook.local`)
   - Password: your choice, at least 8 characters
2. Copy the new user's **User UID** from the list (a long string like `x8Fk2…`).
3. **Firestore Database → Data → Start collection.**
   - Collection ID: `admins`
   - Document ID: paste the **User UID**
   - Add a field: name `username`, type string, value `madhup`
   - Save

Having a login isn't enough on its own. Only accounts with a document in `admins` can get into the panel or change content.

### 5. Let the panel upload photos to Cloudinary

1. Cloudinary → **Settings** (gear icon) → **Upload** → **Upload presets** → **Add upload preset**.
2. Set **Signing mode** to **Unsigned**.
3. Optional but recommended: set a folder (e.g. `scrapbook`) and limit **Allowed formats** to `jpg, jpeg, png, webp, heic, gif, mp4, mov`.
4. Save, and copy the preset's **name** into `cloudinaryUploadPreset` in `js/config.js`.

An unsigned preset can only upload, never delete or overwrite your photos.

### 6. Go live

1. Commit and push the changes. Vercel redeploys in about a minute.
2. Open `https://your-site.vercel.app/admin` and sign in.
3. On the overview, click **Import content/site.json**. Your existing sections and entries are copied into the database.
4. From now on the public site reads from the database automatically. You don't need to edit `site.json` any more.

---

## Using the panel

- **Sections, sub-sections, entries:** the list on the left. Use *New section*, *New sub-section* or *New entry*, then fill in the form.
- **Photos:** click *Upload a photo* (or drop one onto the box). Galleries take several at once.
- **Videos:** upload to YouTube as **Unlisted** and paste the link into a Video block. Short clips can be uploaded to Cloudinary instead.
- **Drafts:** *Save draft* keeps an entry private. *Publish* puts it on the site; *Unpublish* takes it down again.
- **Order:** the arrow buttons on a section or sub-section move it up or down. Inside an entry, arrows move blocks.
- **Deleting** a section also deletes its sub-sections and entries (you're asked first). Photos stay in Cloudinary.
- **Admins page:** add or remove admins and change your own password. Removing someone stops them signing in. To delete their login completely, remove it under Firebase → Authentication → Users too.

---

## Run it on your computer

Because pages load with `fetch`, use a local server rather than double-clicking `index.html`:

- VS Code: **Live Server** extension → right-click `index.html` → *Open with Live Server*
- Node: `npx serve .`
- Python: `python -m http.server 8000`, then open http://localhost:8000

## Content format (for reference)

The database uses the same fields as `content/site.json`:

| Field | Where | Notes |
|---|---|---|
| `id` | all | Used in the URL. Set from the title when created. |
| `order` | sections, sub-sections | Lower numbers come first. |
| `sectionId` | sub-sections | Which section it belongs to. |
| `sort` | sub-sections | `"oldest"` for trips (day 1 first). Default is newest first. |
| `subsectionId` | entries | Which sub-section it belongs to. |
| `date` | entries | `YYYY-MM-DD`. |
| `location`, `excerpt`, `cover` | entries | Optional. `cover` is a Cloudinary public ID or URL. |
| `draft` | entries | `true` hides it from the public site. |

Blocks:

```json
{ "type": "text", "body": "Paragraphs, ## headings, - lists, **bold**, *italic*, [links](https://...)" }
{ "type": "image", "src": "public-id-or-url", "caption": "…", "wide": true }
{ "type": "gallery", "caption": "…", "images": [{ "src": "…", "caption": "…" }] }
{ "type": "video", "youtube": "link", "caption": "…" }
{ "type": "video", "cloudinary": "https://res.cloudinary.com/…/clip.mp4" }
{ "type": "quote", "text": "…", "cite": "…" }
```

`contentSource` in `js/config.js` controls where the public site reads from: `"auto"` (database once it has content, otherwise `site.json`), `"firestore"` or `"json"`.

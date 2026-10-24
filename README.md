# Scrapbook

A personal scrapbook and blog. Content is organised as **sections → sub-sections → entries**, and each entry mixes text, photos, galleries, quotes and video.

Plain HTML, CSS and JavaScript. No build step.

```
index.html
css/styles.css        all styling; colours and fonts are tokens at the top
js/config.js          your Cloudinary cloud name + where content comes from
js/app.js             pages, navigation, sidebar
js/data.js            loads content (JSON now, Firestore later)
js/media.js           Cloudinary image/video URLs, YouTube links
js/lightbox.js        full-screen photo viewer
js/markdown.js        formatting inside text blocks
content/site.json     all your sections, sub-sections and entries
```

## 1. Run it on your computer

The site loads `content/site.json` with `fetch`, so it needs a local server (double-clicking `index.html` won't work).

Any one of these, from inside the `scrapbook` folder:

- VS Code: install the **Live Server** extension, right-click `index.html`, choose *Open with Live Server*.
- Node: `npx serve .`
- Python: `python -m http.server 8000`, then open http://localhost:8000

## 2. Connect Cloudinary (images)

1. Sign up at cloudinary.com (free plan, no card).
2. Copy your **cloud name** from the dashboard into `js/config.js`.
3. Upload photos in the Media Library. Folders help, e.g. `scrapbook/himachal-2026/`.
4. Use the photo's **public ID** as the `src`:

```json
{ "type": "image", "src": "scrapbook/himachal-2026/bus-window", "caption": "First light" }
```

You can also paste the full Cloudinary URL. Either way the site automatically requests the right size and format (WebP/AVIF) for each screen, so you can upload full-resolution photos.

## 3. Add YouTube videos

Upload to YouTube as **Unlisted** (only people with the link, or your site, can see it), then paste any YouTube link:

```json
{ "type": "video", "youtube": "https://youtu.be/VIDEO_ID", "caption": "The trail up" }
```

Videos load only when clicked, so pages stay fast. Short clips can live on Cloudinary instead: `{ "type": "video", "cloudinary": "scrapbook/clip-01" }`.

## 4. Write content

Everything lives in `content/site.json`.

**Sections** are the top level (Travel, Projects…). **Sub-sections** sit inside a section (Himachal 2026…). **Entries** sit inside a sub-section.

| Field | Where | Notes |
|---|---|---|
| `id` | all | Used in the URL. Lowercase, hyphens, unique. |
| `order` | sections, sub-sections | Lower numbers come first. |
| `sectionId` | sub-sections | Which section it belongs to. |
| `sort` | sub-sections | `"oldest"` for trips (day 1 first). Default is newest first. |
| `subsectionId` | entries | Which sub-section it belongs to. |
| `date` | entries | `YYYY-MM-DD`. |
| `location`, `excerpt`, `cover` | entries | Optional. `cover` is an image ID or URL. |
| `draft` | entries | `true` hides it from the site. |

**Blocks** make up an entry, in order:

```json
{ "type": "text", "body": "Paragraphs, ## headings, - lists, **bold**, *italic*, [links](https://...)" }
{ "type": "image", "src": "id-or-url", "caption": "…", "wide": true }
{ "type": "gallery", "caption": "…", "images": [{ "src": "…", "caption": "…" }] }
{ "type": "video", "youtube": "link", "caption": "…" }
{ "type": "quote", "text": "…", "cite": "…" }
```

In a `text` body, start a new paragraph with `\n\n`.

The sample photos come from picsum.photos and are random placeholders. Replace them with your own.

## 5. Put it online with Vercel

1. Push this folder to a GitHub repository.
2. In Vercel, choose *Add New → Project* and import the repository.
3. Framework preset: **Other**. Leave build command and output directory empty.
4. Deploy. Every push to GitHub updates the site.

## Next: the upload panel

`js/data.js` is the only file that knows where content comes from. The upload panel will:

- store sections, sub-sections and entries in Firestore using the same fields as `site.json`,
- upload photos straight to Cloudinary from the browser,
- sit behind a Firebase sign-in so only you can post.

The pages you see now won't need to change.

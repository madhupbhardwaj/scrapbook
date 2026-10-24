// Uploading to Cloudinary and the reusable photo picker used across the editors.

import { CONFIG, uploadsConfigured } from "../config.js";
import { imageUrl } from "../media.js";
import { h, ICONS, toast } from "./ui.js";

// Uploads one file with an unsigned preset. Resolves with Cloudinary's response
// ({ public_id, secure_url, resource_type, ... }).
export function uploadFile(file, onProgress) {
  return new Promise((resolve, reject) => {
    if (!uploadsConfigured()) {
      reject(new Error("Photo uploads aren't set up yet. Add your Cloudinary upload preset in js/config.js."));
      return;
    }
    const form = new FormData();
    form.append("file", file);
    form.append("upload_preset", CONFIG.cloudinaryUploadPreset);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${CONFIG.cloudinaryCloudName}/auto/upload`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => {
      let res = null;
      try { res = JSON.parse(xhr.responseText); } catch { /* not JSON */ }
      if (xhr.status >= 200 && xhr.status < 300 && res?.public_id) resolve(res);
      else reject(new Error(res?.error?.message ? `Upload failed: ${res.error.message}` : `Upload failed (HTTP ${xhr.status}).`));
    };
    xhr.onerror = () => reject(new Error("Upload failed. Check your connection and try again."));
    xhr.send(form);
  });
}

function pickFiles({ accept = "image/*", multiple = false } = {}) {
  return new Promise((resolve) => {
    const input = h("input", { type: "file", accept, multiple, hidden: true });
    input.addEventListener("change", () => {
      resolve([...input.files]);
      input.remove();
    });
    input.addEventListener("cancel", () => {
      resolve([]);
      input.remove();
    });
    document.body.append(input);
    input.click();
  });
}

const isImage = (f) => f.type.startsWith("image/") || /\.(heic|heif|jpe?g|png|webp|gif|avif)$/i.test(f.name);

function progressBar() {
  const fill = h("span", { class: "progress-fill" });
  const el = h("div", { class: "progress", role: "progressbar", "aria-label": "Upload progress", "aria-valuemin": "0", "aria-valuemax": "100" }, fill);
  el.set = (p) => {
    const pct = Math.round(p * 100);
    fill.style.width = `${pct}%`;
    el.setAttribute("aria-valuenow", String(pct));
  };
  return el;
}

// Makes an element accept dropped files.
function dropTarget(el, onFiles) {
  el.addEventListener("dragover", (e) => { e.preventDefault(); el.classList.add("is-drag"); });
  el.addEventListener("dragleave", () => el.classList.remove("is-drag"));
  el.addEventListener("drop", (e) => {
    e.preventDefault();
    el.classList.remove("is-drag");
    const files = [...(e.dataTransfer?.files || [])].filter(isImage);
    if (files.length) onFiles(files);
  });
}

/**
 * A single-photo field: preview, upload, replace, remove, or type a Cloudinary ID.
 * getValue/setValue through the `value` argument and onChange(newId).
 */
export function imagePicker(value, onChange, { label = "Photo" } = {}) {
  let current = value || "";
  const root = h("div", { class: "picker" });

  const idInput = h("input", { type: "text", class: "input", value: current, placeholder: "e.g. scrapbook/himachal/bus-window", autocomplete: "off", spellcheck: "false" });
  idInput.addEventListener("change", () => set(idInput.value.trim()));

  function set(id) {
    current = id;
    idInput.value = id;
    onChange(id);
    render();
  }

  async function upload(file) {
    const bar = progressBar();
    root.querySelector(".picker-box").replaceChildren(h("div", { class: "picker-uploading" }, h("span", {}, `Uploading ${file.name}`), bar));
    try {
      const res = await uploadFile(file, bar.set);
      set(res.public_id);
      toast("Photo uploaded");
    } catch (err) {
      toast(err.message, "error");
      render();
    }
  }

  async function choose() {
    const [file] = await pickFiles();
    if (file) upload(file);
  }

  function render() {
    const box = current
      ? h("div", { class: "picker-box has-image" },
          h("img", { src: imageUrl(current, 640), alt: `${label} preview`, loading: "lazy" }),
          h("div", { class: "picker-actions" },
            h("button", { type: "button", class: "btn btn-small", onClick: choose }, "Replace"),
            h("button", { type: "button", class: "btn btn-small btn-quiet", onClick: () => set("") }, "Remove"),
          ))
      : h("button", { type: "button", class: "picker-box picker-empty", onClick: choose },
          h("span", { class: "picker-icon", html: ICONS.image }),
          h("span", {}, h("strong", {}, "Upload a photo"), h("span", { class: "muted" }, " or drop one here")));
    dropTarget(box, ([file]) => upload(file));

    root.replaceChildren(
      box,
      h("details", { class: "picker-id" },
        h("summary", {}, "Use a Cloudinary public ID instead"),
        idInput,
      ),
    );
  }

  render();
  return root;
}

/**
 * Multi-photo uploader for galleries. Calls onUploaded(publicId, file) for each finished file.
 */
export function multiUploader(onUploaded) {
  const list = h("ul", { class: "upload-list" });
  const zone = h("button", { type: "button", class: "dropzone", onClick: async () => start(await pickFiles({ multiple: true })) },
    h("span", { class: "picker-icon", html: ICONS.image }),
    h("span", {}, h("strong", {}, "Add photos"), h("span", { class: "muted" }, " (choose several, or drop them here)")));
  dropTarget(zone, (files) => start(files));

  async function start(files) {
    for (const file of files.filter(isImage)) {
      const bar = progressBar();
      const row = h("li", {}, h("span", { class: "upload-name" }, file.name), bar);
      list.append(row);
      try {
        const res = await uploadFile(file, bar.set);
        onUploaded(res.public_id, file);
        row.remove();
      } catch (err) {
        row.replaceChildren(h("span", { class: "upload-name" }, file.name), h("span", { class: "error-text" }, err.message));
      }
    }
  }

  return h("div", { class: "multi-uploader" }, zone, list);
}

/** Uploads a video clip to Cloudinary. Resolves with its secure URL. */
export async function uploadVideo(onProgress) {
  const [file] = await pickFiles({ accept: "video/*" });
  if (!file) return null;
  const res = await uploadFile(file, onProgress);
  return res.secure_url;
}

export { progressBar };

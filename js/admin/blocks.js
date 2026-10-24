// The entry body builder: a list of blocks (text, photo, gallery, video, quote)
// that can be added, edited, reordered and removed.

import { youtubeId } from "../media.js";
import { imageUrl } from "../media.js";
import { h, iconButton, field, confirmDialog, toast } from "./ui.js";
import { imagePicker, multiUploader, uploadVideo, progressBar } from "./upload.js";

const TYPES = {
  text: { label: "Text", make: () => ({ type: "text", body: "" }) },
  image: { label: "Photo", make: () => ({ type: "image", src: "", caption: "", wide: false }) },
  gallery: { label: "Gallery", make: () => ({ type: "gallery", caption: "", images: [] }) },
  video: { label: "Video", make: () => ({ type: "video", youtube: "", caption: "" }) },
  quote: { label: "Quote", make: () => ({ type: "quote", text: "", cite: "" }) },
};

const hasContent = (b) =>
  !!(b.body || b.src || b.text || b.youtube || b.cloudinary || b.caption || b.images?.length);

function autosize(textarea) {
  const fit = () => {
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight + 2}px`;
  };
  textarea.addEventListener("input", fit);
  requestAnimationFrame(fit);
  return textarea;
}

/**
 * blocks: the array to edit (mutated in place).
 * onChange: called after any change, so the editor can mark itself unsaved.
 */
export function blockEditor(blocks, onChange) {
  const list = h("ol", { class: "blocks" });
  const root = h("div", { class: "block-editor" },
    list,
    h("div", { class: "add-block" },
      h("span", { class: "add-block-label" }, "Add"),
      Object.entries(TYPES).map(([type, t]) =>
        h("button", { type: "button", class: "btn btn-small", onClick: () => add(type) }, t.label)),
    ),
  );

  const changed = () => onChange?.();

  function add(type) {
    blocks.push(TYPES[type].make());
    changed();
    render();
    const cards = list.querySelectorAll(".block");
    const last = cards[cards.length - 1];
    last?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    last?.querySelector("textarea, input:not([type=checkbox])")?.focus({ preventScroll: true });
  }

  function move(i, delta) {
    const j = i + delta;
    if (j < 0 || j >= blocks.length) return;
    [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
    changed();
    render();
    list.querySelectorAll(".block")[j]?.querySelector(`[aria-label="${delta < 0 ? "Move block up" : "Move block down"}"]`)?.focus();
  }

  async function remove(i) {
    if (hasContent(blocks[i])) {
      const ok = await confirmDialog({ title: `Remove this ${TYPES[blocks[i].type]?.label.toLowerCase() || "block"}?`, message: "Its content will be removed from the entry when you save.", confirmLabel: "Remove", danger: true });
      if (!ok) return;
    }
    blocks.splice(i, 1);
    changed();
    render();
  }

  function render() {
    list.replaceChildren(...blocks.map((b, i) =>
      h("li", { class: "block", dataset: { type: b.type } },
        h("div", { class: "block-head" },
          h("span", { class: "block-type" }, TYPES[b.type]?.label || b.type),
          h("div", { class: "block-tools" },
            iconButton("up", "Move block up", () => move(i, -1), { disabled: i === 0 }),
            iconButton("down", "Move block down", () => move(i, 1), { disabled: i === blocks.length - 1 }),
            iconButton("remove", "Remove block", () => remove(i)),
          ),
        ),
        h("div", { class: "block-body" }, body(b)),
      )));
    if (!blocks.length) {
      list.append(h("li", { class: "blocks-empty" }, "This entry has no content yet. Add text, photos or a video below."));
    }
  }

  function input(b, key, attrs = {}) {
    const el = h(attrs.multiline ? "textarea" : "input", {
      class: "input", value: b[key] || "", placeholder: attrs.placeholder || "", rows: attrs.rows,
      type: attrs.multiline ? null : "text",
    });
    el.addEventListener("input", () => { b[key] = el.value; changed(); });
    return attrs.multiline ? autosize(el) : el;
  }

  function body(b) {
    switch (b.type) {
      case "text": {
        const area = input(b, "body", { multiline: true, rows: 6, placeholder: "Write here…" });
        area.setAttribute("aria-label", "Text");
        return [area, h("p", { class: "hint" }, "New paragraph: leave an empty line. ## Heading, - list item, **bold**, *italic*, [link text](https://…)")];
      }

      case "image": {
        const wide = h("input", { type: "checkbox", checked: !!b.wide });
        wide.addEventListener("change", () => { b.wide = wide.checked; changed(); });
        return [
          imagePicker(b.src, (id) => { b.src = id; changed(); }),
          field("Caption", input(b, "caption", { placeholder: "Optional" })),
          h("label", { class: "check" }, wide, " Show wider than the text"),
        ];
      }

      case "gallery":
        return galleryBody(b);

      case "video":
        return videoBody(b);

      case "quote":
        return [
          field("Quote", input(b, "text", { multiline: true, rows: 2 })),
          field("Said by / source", input(b, "cite", { placeholder: "Optional" })),
        ];

      default:
        return h("p", { class: "muted" }, "This block type can't be edited here.");
    }
  }

  function galleryBody(b) {
    b.images ||= [];
    const grid = h("ul", { class: "gallery-edit" });

    const draw = () => {
      grid.replaceChildren(...b.images.map((im, i) => {
        const cap = h("input", { class: "input input-small", value: im.caption || "", placeholder: "Caption", "aria-label": `Caption for photo ${i + 1}` });
        cap.addEventListener("input", () => { im.caption = cap.value; changed(); });
        return h("li", { class: "g-item" },
          h("img", { src: imageUrl(im.src, 400), alt: im.caption || `Photo ${i + 1}`, loading: "lazy" }),
          cap,
          h("div", { class: "g-tools" },
            iconButton("left", "Move photo earlier", () => { if (i > 0) { [b.images[i - 1], b.images[i]] = [b.images[i], b.images[i - 1]]; changed(); draw(); } }, { disabled: i === 0 }),
            iconButton("right", "Move photo later", () => { if (i < b.images.length - 1) { [b.images[i + 1], b.images[i]] = [b.images[i], b.images[i + 1]]; changed(); draw(); } }, { disabled: i === b.images.length - 1 }),
            iconButton("remove", "Remove photo", () => { b.images.splice(i, 1); changed(); draw(); }),
          ),
        );
      }));
    };
    draw();

    return [
      grid,
      multiUploader((id) => { b.images.push({ src: id, caption: "" }); changed(); draw(); }),
      field("Gallery caption", input(b, "caption", { placeholder: "Optional" })),
    ];
  }

  function videoBody(b) {
    const preview = h("div", { class: "video-preview" });
    const link = h("input", { class: "input", value: b.youtube || "", placeholder: "https://youtu.be/…", type: "url", inputmode: "url" });
    const clipStatus = h("div", { class: "clip-status" });

    const drawPreview = () => {
      const id = youtubeId(b.youtube || "");
      if (b.youtube && id) {
        preview.replaceChildren(h("img", { src: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`, alt: "Video thumbnail" }));
      } else if (b.cloudinary) {
        preview.replaceChildren(h("video", { src: b.cloudinary, controls: true, preload: "metadata" }));
      } else if (b.youtube) {
        preview.replaceChildren(h("p", { class: "error-text" }, "That doesn't look like a YouTube link."));
      } else {
        preview.replaceChildren();
      }
      clipStatus.replaceChildren(b.cloudinary && !b.youtube
        ? h("button", { type: "button", class: "btn btn-small btn-quiet", onClick: () => { delete b.cloudinary; changed(); drawPreview(); } }, "Remove uploaded clip")
        : "");
    };

    link.addEventListener("input", () => {
      b.youtube = link.value.trim();
      if (b.youtube) delete b.cloudinary;
      changed();
      drawPreview();
    });

    const uploadBtn = h("button", { type: "button", class: "btn btn-small", onClick: async () => {
      const bar = progressBar();
      clipStatus.replaceChildren(bar);
      try {
        const url = await uploadVideo(bar.set);
        if (url) {
          b.cloudinary = url;
          b.youtube = "";
          link.value = "";
          changed();
          toast("Clip uploaded");
        }
      } catch (err) {
        toast(err.message, "error");
      }
      drawPreview();
    } }, "Upload a short clip instead");

    drawPreview();
    return [
      field("YouTube link", link, "Upload to YouTube as Unlisted, then paste the link."),
      preview,
      h("div", { class: "row" }, uploadBtn, clipStatus),
      field("Caption", input(b, "caption", { placeholder: "Optional" })),
    ];
  }

  render();
  return root;
}

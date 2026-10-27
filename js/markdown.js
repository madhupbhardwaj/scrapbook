// A small, safe Markdown renderer for text blocks.
// Supports: ## / ### / #### headings, paragraphs, - lists, 1. lists,
// **bold**, *italic*, __underline__, ++bigger text++, `code`, [links](https://...).
// All input is HTML-escaped first.

const ENTITIES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ENTITIES[c]);

const SAFE_URL = /^(https?:|mailto:|#|\/)/i;

function inline(text) {
  let s = esc(text);
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
  // Underline and bigger text. They must not start or end mid-word, so web
  // addresses that happen to contain "__" or "++" are left alone.
  s = s.replace(/(^|[^\w])__(?=\S)([^_]*?\S)__(?!\w)/g, "$1<u>$2</u>");
  s = s.replace(/(^|[^\w+])\+\+(?=\S)([^+]*?\S)\+\+(?![\w+])/g, '$1<span class="big">$2</span>');
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) => {
    if (!SAFE_URL.test(url)) return label;
    const external = /^https?:/i.test(url);
    return `<a href="${url}"${external ? ' target="_blank" rel="noopener"' : ""}>${label}</a>`;
  });
  return s;
}

export function md(src = "") {
  const out = [];
  let para = [];
  let list = null;

  const flushPara = () => {
    if (para.length) out.push(`<p>${inline(para.join(" "))}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list) out.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join("")}</${list.tag}>`);
    list = null;
  };
  const addItem = (tag, text) => {
    flushPara();
    if (!list || list.tag !== tag) {
      flushList();
      list = { tag, items: [] };
    }
    list.items.push(text);
  };

  for (const raw of String(src).replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    let m;
    if (!line) {
      flushPara();
      flushList();
    } else if ((m = line.match(/^(#{2,4})\s+(.+)$/))) {
      flushPara();
      flushList();
      const level = m[1].length;
      out.push(`<h${level}>${inline(m[2])}</h${level}>`);
    } else if ((m = line.match(/^[-*]\s+(.+)$/))) {
      addItem("ul", m[1]);
    } else if ((m = line.match(/^\d+[.)]\s+(.+)$/))) {
      addItem("ol", m[1]);
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return out.join("\n");
}

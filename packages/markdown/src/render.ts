import { Marked, type TokenizerAndRendererExtension } from "marked";

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const wikiLink: TokenizerAndRendererExtension = {
  name: "wikilink",
  level: "inline",
  start(src) {
    const index = src.indexOf("[[");
    return index === -1 ? undefined : index;
  },
  tokenizer(src) {
    const match = /^\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/.exec(src);
    const target = match?.[1]?.trim();
    if (!match || !target) return undefined;
    return {
      type: "wikilink",
      raw: match[0],
      target,
      label: (match[3] ?? target).trim(),
    };
  },
  renderer(token) {
    const target = String(token.target ?? "");
    const label = String(token.label ?? target);
    return `<a class="wikilink" data-target="${escapeHtml(target)}">${escapeHtml(label)}</a>`;
  },
};

const hashTag: TokenizerAndRendererExtension = {
  name: "hashtag",
  level: "inline",
  start(src) {
    const index = src.search(/#([\p{Script=Han}\p{L}])/u);
    return index === -1 ? undefined : index;
  },
  tokenizer(src) {
    const match = /^#([\p{Script=Han}\p{L}\d/_-]+)/u.exec(src);
    const tag = match?.[1];
    if (!match || !tag) return undefined;
    if (src.startsWith("# ")) return undefined;
    return {
      type: "hashtag",
      raw: match[0],
      tag,
    };
  },
  renderer(token) {
    const tag = String(token.tag ?? "");
    return `<span class="tag">#${escapeHtml(tag)}</span>`;
  },
};

const parser = new Marked();
parser.use({
  gfm: true,
  breaks: true,
  extensions: [wikiLink, hashTag],
  renderer: {
    html() {
      return "";
    },
  },
});

export function renderMarkdownToHtml(markdown: string): string {
  const withoutFence = markdown.replace(/^---[\s\S]*?---\n*/, "");
  return parser.parse(withoutFence, { async: false }) as string;
}

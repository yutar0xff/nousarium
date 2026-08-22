function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function renderMarkdownToHtml(markdown: string): string {
  const withoutFence = markdown.replace(/^---[\s\S]*?---\n*/, "");
  const withWiki = withoutFence.replace(
    /\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g,
    (_all, target: string, _heading: string | undefined, label: string | undefined) =>
      `<a class="wikilink" data-target="${escapeHtml(target.trim())}">${escapeHtml((label ?? target).trim())}</a>`,
  );
  const withTags = withWiki.replace(
    /(^|\s)#([\p{Script=Han}\p{L}\d/_-]+)/gu,
    (_all, prefix: string, tag: string) => `${prefix}<span class="tag">#${escapeHtml(tag)}</span>`,
  );
  const blocks = withTags.split(/\n{2,}/).map((block) => {
    const line = block.trim();
    if (!line) return "";
    if (line.startsWith("### ")) return `<h3>${line.slice(4)}</h3>`;
    if (line.startsWith("## ")) return `<h2>${line.slice(3)}</h2>`;
    if (line.startsWith("# ")) return `<h1>${line.slice(2)}</h1>`;
    if (line.startsWith("- ")) {
      const items = line.split("\n").map((item) => `<li>${item.replace(/^- /, "")}</li>`).join("");
      return `<ul>${items}</ul>`;
    }
    return `<p>${line.replaceAll("\n", "<br />")}</p>`;
  });
  return blocks.join("\n");
}

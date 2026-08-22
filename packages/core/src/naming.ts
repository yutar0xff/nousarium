const INVALID = /[\\/:*?"<>|]/g;

/** タイトルなど可変部分の単語区切り。スペースは `_` に統一する。 */
export function slugifyFileName(name: string): string {
  const normalized = name
    .trim()
    .replace(INVALID, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized.slice(0, 80) || "untitled";
}

/** @deprecated Use slugifyFileName for paths. */
export const slugifyTitle = slugifyFileName;

/** ISO 8601 基本形式（ファイル名向け）。例: 20260822T162045 */
export function formatFileNameTimestamp(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${y}${m}${d}T${hh}${mm}${ss}`;
}

/**
 * 会話ジャーナルのファイル名。
 * 先頭は ISO 8601 基本形式のタイムスタンプ、`-` でタイトル塊と分離、タイトル内は `_`。
 * 例: 20260822T162045-vault_整理.md
 */
export function journalFileName(date: Date, title: string): string {
  return `${formatFileNameTimestamp(date)}-${slugifyFileName(title)}.md`;
}

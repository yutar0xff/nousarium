export function slugifyTitle(title: string): string {
  const trimmed = title.trim().replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ");
  return trimmed.slice(0, 80) || "untitled";
}

export function journalFileName(date: Date, title: string): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d} ${hh}${mm} - ${slugifyTitle(title)}.md`;
}

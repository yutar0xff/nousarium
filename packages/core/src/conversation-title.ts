export const CONVERSATION_TITLE_PLACEHOLDER = "新しい対話";

export function needsGeneratedTitle(title: string): boolean {
  const trimmed = title.trim();
  return !trimmed || trimmed === CONVERSATION_TITLE_PLACEHOLDER;
}

export function fallbackConversationTitle(message: string): string {
  const firstLine = message.trim().split(/\r?\n/)[0]?.trim() ?? "";
  const compact = firstLine.replace(/\s+/g, " ").slice(0, 24).trim();
  return compact || "対話";
}

export function sanitizeConversationTitle(raw: string, fallbackMessage: string): string {
  const firstLine = raw
    .trim()
    .split(/\r?\n/)[0]
    ?.replace(/^["'「『]+|["'」』]+$/g, "")
    .replace(/^[#*\s-]+/, "")
    .trim() ?? "";
  const compact = firstLine.replace(/\s+/g, " ").slice(0, 24).trim();
  if (!compact) return fallbackConversationTitle(fallbackMessage);
  return compact;
}

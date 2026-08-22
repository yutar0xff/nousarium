export const DEFAULT_MODEL_ID = "auto";

export const MODEL_OPTIONS = [
  { id: "auto", label: "Auto" },
  { id: "composer-2.5", label: "Composer 2.5" },
  { id: "claude-4-sonnet", label: "Claude 4 Sonnet" },
  { id: "claude-4-opus", label: "Claude 4 Opus" },
  { id: "gpt-5", label: "GPT-5" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
] as const;

export function resolveModelId(conversationModel: string, fallback = DEFAULT_MODEL_ID): string {
  const trimmed = conversationModel.trim();
  return trimmed || fallback;
}

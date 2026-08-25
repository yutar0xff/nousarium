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

function isAutoModel(id: string, label: string): boolean {
  return id.toLowerCase() === "auto" || label.toLowerCase() === "auto";
}

export function normalizeModelOptions(
  models: Array<{ id: string; label: string }>,
): Array<{ id: string; label: string }> {
  const seen = new Set<string>();
  const result: Array<{ id: string; label: string }> = [];
  for (const model of models) {
    const id = model.id.trim();
    const label = model.label.trim() || id;
    if (!id) continue;
    const auto = isAutoModel(id, label);
    const key = auto ? DEFAULT_MODEL_ID : id.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(auto ? { id: DEFAULT_MODEL_ID, label: "Auto" } : { id, label });
  }
  if (!seen.has(DEFAULT_MODEL_ID)) {
    result.unshift({ id: DEFAULT_MODEL_ID, label: "Auto" });
  }
  return result;
}

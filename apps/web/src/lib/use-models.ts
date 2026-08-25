import type { ModelOption, ModelsResponse } from "@nousarium/contracts";
import { MODEL_OPTIONS, normalizeModelOptions } from "@nousarium/core";
import { useEffect, useState } from "react";
import { api } from "./api";

const FALLBACK: ModelOption[] = normalizeModelOptions(
  MODEL_OPTIONS.map((option) => ({ id: option.id, label: option.label })),
);

export function useModels() {
  const [models, setModels] = useState<ModelOption[]>(FALLBACK);
  const [defaultModel, setDefaultModel] = useState("auto");

  useEffect(() => {
    void api<ModelsResponse>("/models")
      .then((payload) => {
        if (payload.models.length) setModels(normalizeModelOptions(payload.models));
        if (payload.default?.trim()) setDefaultModel(payload.default.trim());
      })
      .catch(() => setModels(FALLBACK));
  }, []);

  function optionsFor(current: string): ModelOption[] {
    const id = current.trim();
    if (!id) return models;
    if (models.some((model) => model.id.toLowerCase() === id.toLowerCase())) return models;
    return normalizeModelOptions([{ id, label: id }, ...models]);
  }

  return { models, defaultModel, optionsFor };
}

import type { AgentPort } from "@nousarium/core";
import { createCursorAgentPort } from "./cursor-adapter.js";
import { createScriptedAgentPort } from "./scripted-adapter.js";

export function createAgentPort(input: {
  apiKey?: string;
  model?: string;
  storePath?: string;
  sandboxEnabled?: boolean;
}): AgentPort {
  if (input.apiKey && input.storePath) {
    return createCursorAgentPort({
      apiKey: input.apiKey,
      model: input.model,
      storePath: input.storePath,
      sandboxEnabled: input.sandboxEnabled ?? true,
    });
  }
  return createScriptedAgentPort();
}

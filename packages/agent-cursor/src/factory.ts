import type { AgentPort } from "@nousarium/core";
import { createCursorAgentPort } from "./cursor-adapter.js";
import { createScriptedAgentPort } from "./scripted-adapter.js";

export function createAgentPort(input: {
  apiKey?: string;
  model?: string;
  storePath?: string;
}): AgentPort {
  if (input.apiKey && input.storePath) {
    return createCursorAgentPort({
      apiKey: input.apiKey,
      model: input.model,
      storePath: input.storePath,
    });
  }
  return createScriptedAgentPort();
}

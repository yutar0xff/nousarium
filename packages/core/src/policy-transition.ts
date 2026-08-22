import type { AccessPolicy, Conversation, ConversationMode } from "@nousarium/contracts";

export function snapshotPolicy(conversation: Conversation): {
  mode: ConversationMode;
  accessPolicy: AccessPolicy;
  model: string;
} {
  return {
    mode: conversation.pendingMode ?? conversation.mode,
    accessPolicy: conversation.pendingAccessPolicy ?? conversation.accessPolicy,
    model: conversation.pendingModel ?? conversation.model,
  };
}

function normalizePending(
  conversation: Conversation,
  pendingMode: ConversationMode | null,
  pendingAccessPolicy: AccessPolicy | null,
  pendingModel: string | null,
): Pick<Conversation, "pendingMode" | "pendingAccessPolicy" | "pendingModel"> {
  return {
    pendingMode: pendingMode && pendingMode !== conversation.mode ? pendingMode : null,
    pendingAccessPolicy:
      pendingAccessPolicy && pendingAccessPolicy !== conversation.accessPolicy ? pendingAccessPolicy : null,
    pendingModel: pendingModel && pendingModel !== conversation.model ? pendingModel : null,
  };
}

export function applyPendingPolicy(
  conversation: Conversation,
  next: { mode?: ConversationMode; accessPolicy?: AccessPolicy; model?: string },
  running: boolean,
): Conversation {
  const pendingMode = next.mode !== undefined ? next.mode : conversation.pendingMode;
  const pendingAccessPolicy =
    next.accessPolicy !== undefined ? next.accessPolicy : conversation.pendingAccessPolicy;
  const pendingModel = next.model !== undefined ? next.model : conversation.pendingModel;

  if (running) {
    return {
      ...conversation,
      ...normalizePending(conversation, pendingMode, pendingAccessPolicy, pendingModel),
    };
  }

  return {
    ...conversation,
    ...normalizePending(conversation, pendingMode, pendingAccessPolicy, pendingModel),
  };
}

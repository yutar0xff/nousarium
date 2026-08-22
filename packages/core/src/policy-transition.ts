import type { AccessPolicy, Conversation, ConversationMode } from "@nousarium/contracts";

export function snapshotPolicy(conversation: Conversation): {
  mode: ConversationMode;
  accessPolicy: AccessPolicy;
} {
  return {
    mode: conversation.pendingMode ?? conversation.mode,
    accessPolicy: conversation.pendingAccessPolicy ?? conversation.accessPolicy,
  };
}

export function applyPendingPolicy(
  conversation: Conversation,
  next: { mode?: ConversationMode; accessPolicy?: AccessPolicy },
  running: boolean,
): Conversation {
  const mode = next.mode ?? conversation.mode;
  const accessPolicy = next.accessPolicy ?? conversation.accessPolicy;
  if (running) {
    return {
      ...conversation,
      pendingMode: mode,
      pendingAccessPolicy: accessPolicy,
    };
  }
  return {
    ...conversation,
    mode,
    accessPolicy,
    pendingMode: null,
    pendingAccessPolicy: null,
  };
}

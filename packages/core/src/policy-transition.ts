import type { AccessPolicy, Conversation } from "@nousarium/contracts";

export function snapshotPolicy(conversation: Conversation): {
  accessPolicy: AccessPolicy;
  model: string;
} {
  return {
    accessPolicy: conversation.pendingAccessPolicy ?? conversation.accessPolicy,
    model: conversation.pendingModel ?? conversation.model,
  };
}

function normalizePending(
  conversation: Conversation,
  pendingAccessPolicy: AccessPolicy | null,
  pendingModel: string | null,
): Pick<Conversation, "pendingAccessPolicy" | "pendingModel"> {
  return {
    pendingAccessPolicy:
      pendingAccessPolicy && pendingAccessPolicy !== conversation.accessPolicy ? pendingAccessPolicy : null,
    pendingModel: pendingModel && pendingModel !== conversation.model ? pendingModel : null,
  };
}

export function applyPendingPolicy(
  conversation: Conversation,
  next: { accessPolicy?: AccessPolicy; model?: string },
  _running: boolean,
): Conversation {
  const pendingAccessPolicy =
    next.accessPolicy !== undefined ? next.accessPolicy : conversation.pendingAccessPolicy;
  const pendingModel = next.model !== undefined ? next.model : conversation.pendingModel;
  return {
    ...conversation,
    ...normalizePending(conversation, pendingAccessPolicy, pendingModel),
  };
}

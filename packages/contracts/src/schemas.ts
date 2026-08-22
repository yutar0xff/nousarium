import { z } from "zod";

export const modelIdSchema = z.string().min(1);
export type ModelId = z.infer<typeof modelIdSchema>;

export const accessPolicySchema = z.enum(["chat", "vault"]);
export type AccessPolicy = z.infer<typeof accessPolicySchema>;

export const runStatusSchema = z.enum(["queued", "running", "finished", "error", "cancelled"]);
export type RunStatus = z.infer<typeof runStatusSchema>;

export const conversationSchema = z.object({
  id: z.string(),
  title: z.string(),
  cursorAgentId: z.string().nullable(),
  model: modelIdSchema,
  accessPolicy: accessPolicySchema,
  pendingAccessPolicy: accessPolicySchema.nullable(),
  pendingModel: modelIdSchema.nullable(),
  journalPath: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Conversation = z.infer<typeof conversationSchema>;

export const messageSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
  runId: z.string().nullable(),
  accessPolicy: accessPolicySchema.nullable(),
  createdAt: z.string(),
});
export type Message = z.infer<typeof messageSchema>;

export const runSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  status: runStatusSchema,
  model: modelIdSchema,
  accessPolicy: accessPolicySchema,
  gitBefore: z.string().nullable(),
  gitAfter: z.string().nullable(),
  error: z.string().nullable(),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
});
export type Run = z.infer<typeof runSchema>;

export const vaultEntrySchema = z.object({
  path: z.string(),
  name: z.string(),
  kind: z.enum(["file", "directory"]),
  updatedAt: z.string().nullable(),
});
export type VaultEntry = z.infer<typeof vaultEntrySchema>;

export const vaultDocumentSchema = z.object({
  path: z.string(),
  content: z.string(),
  hash: z.string(),
});
export type VaultDocument = z.infer<typeof vaultDocumentSchema>;

export const searchQuerySchema = z.object({
  q: z.string().min(1),
  limit: z.number().int().min(1).max(100).optional(),
  prefix: z.string().optional(),
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;

export const searchHitSchema = z.object({
  path: z.string(),
  line: z.number(),
  preview: z.string(),
});
export type SearchHit = z.infer<typeof searchHitSchema>;

export const noteConversationLinkSchema = z.object({
  conversationId: z.string().nullable(),
  title: z.string(),
  journalPath: z.string(),
  updatedAt: z.string().nullable(),
});
export type NoteConversationLink = z.infer<typeof noteConversationLinkSchema>;

export const noteRelationsSchema = z.object({
  edited: z.array(noteConversationLinkSchema),
  referenced: z.array(noteConversationLinkSchema),
});
export type NoteRelations = z.infer<typeof noteRelationsSchema>;

export const saveDocumentRequestSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
  expectedHash: z.string().nullable(),
  overwrite: z.boolean().optional(),
});
export type SaveDocumentRequest = z.infer<typeof saveDocumentRequestSchema>;

export const fileDiffSchema = z.object({
  path: z.string(),
  status: z.enum(["added", "modified", "deleted"]),
  patch: z.string(),
});
export type FileDiff = z.infer<typeof fileDiffSchema>;

export const createConversationRequestSchema = z.object({
  title: z.string().optional(),
  model: modelIdSchema.default("auto"),
  accessPolicy: accessPolicySchema.optional(),
});

export const sendMessageRequestSchema = z.object({
  content: z.string().min(1),
  accessPolicy: accessPolicySchema.optional(),
  model: modelIdSchema.optional(),
});
export type SendMessageRequest = z.infer<typeof sendMessageRequestSchema>;

export const updatePolicyRequestSchema = z.object({
  accessPolicy: accessPolicySchema.optional(),
  model: modelIdSchema.optional(),
});
export type UpdatePolicyRequest = z.infer<typeof updatePolicyRequestSchema>;

export const runStatusPhaseSchema = z.enum(["sending", "titling", "checkpoint", "starting", "thinking"]);
export type RunStatusPhase = z.infer<typeof runStatusPhaseSchema>;

export const agentEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("run.started"),
    runId: z.string(),
    conversationId: z.string(),
    accessPolicy: accessPolicySchema,
  }),
  z.object({
    type: z.literal("run.status"),
    runId: z.string(),
    phase: runStatusPhaseSchema,
  }),
  z.object({
    type: z.literal("agent.bound"),
    runId: z.string(),
    agentId: z.string(),
  }),
  z.object({
    type: z.literal("assistant.delta"),
    runId: z.string(),
    text: z.string(),
  }),
  z.object({
    type: z.literal("tool.started"),
    runId: z.string(),
    tool: z.string(),
    detail: z.string().optional(),
  }),
  z.object({
    type: z.literal("tool.completed"),
    runId: z.string(),
    tool: z.string(),
    detail: z.string().optional(),
  }),
  z.object({
    type: z.literal("conversation.titled"),
    conversationId: z.string(),
    title: z.string(),
  }),
  z.object({
    type: z.literal("run.finished"),
    runId: z.string(),
    status: z.enum(["finished", "error", "cancelled"]),
    result: z.string().optional(),
    error: z.string().optional(),
    diffs: z.array(fileDiffSchema).optional(),
  }),
]);
export type AgentEvent = z.infer<typeof agentEventSchema>;

import type {
  AccessPolicy,
  AgentEvent,
  Conversation,
  FileDiff,
  Message,
  Run,
  SaveDocumentRequest,
  SearchHit,
  SearchQuery,
  VaultDocument,
  VaultEntry,
} from "@nousarium/contracts";

export interface AgentInput {
  conversation: Conversation;
  runId: string;
  message: string;
  history: Message[];
  model: string;
  accessPolicy: AccessPolicy;
  vaultPath: string;
}

export interface AgentPort {
  send(input: AgentInput): AsyncIterable<AgentEvent>;
  cancel(runId: string): Promise<void>;
  generateConversationTitle(message: string, model?: string): Promise<string>;
}

export interface VaultPort {
  list(path?: string): Promise<VaultEntry[]>;
  read(path: string): Promise<VaultDocument>;
  save(input: SaveDocumentRequest): Promise<VaultDocument>;
  search(query: SearchQuery): Promise<SearchHit[]>;
  exists(path: string): Promise<boolean>;
  mkdir(path: string): Promise<void>;
}

export interface VersionControlPort {
  ensureRepo(): Promise<void>;
  checkpoint(label: string): Promise<string>;
  commitRun(runId: string, message: string): Promise<string | null>;
  diff(from: string, to?: string): Promise<FileDiff[]>;
  revertRun(runId: string): Promise<string>;
  currentHead(): Promise<string | null>;
}

export interface ConversationStore {
  listConversations(): Promise<Conversation[]>;
  getConversation(id: string): Promise<Conversation | null>;
  createConversation(input: {
    title: string;
    model: string;
    accessPolicy: AccessPolicy;
  }): Promise<Conversation>;
  updateConversation(id: string, patch: Partial<Conversation>): Promise<Conversation>;
  listMessages(conversationId: string): Promise<Message[]>;
  addMessage(message: Omit<Message, "id" | "createdAt"> & { id?: string }): Promise<Message>;
  createRun(run: Omit<Run, "finishedAt" | "error" | "gitAfter"> & { error?: string | null; gitAfter?: string | null }): Promise<Run>;
  updateRun(id: string, patch: Partial<Run>): Promise<Run>;
  listRuns(conversationId?: string): Promise<Run[]>;
  getRun(id: string): Promise<Run | null>;
}

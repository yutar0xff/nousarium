import type { AccessPolicy } from "@nousarium/contracts";

export const CONVERSATION_MODE_LABELS = {
  plan: "検討",
  agent: "実行",
} as const;

export const ACCESS_POLICY_LABELS = {
  chat: "会話",
  read: "参照",
  "vault-work": "Vault作業",
} as const;

const POLICY_TOOLS: Record<AccessPolicy, string[] | undefined> = {
  chat: [],
  read: ["read", "grep", "glob", "ls"],
  "vault-work": undefined,
};

export function toolsForPolicy(policy: AccessPolicy): string[] | undefined {
  return POLICY_TOOLS[policy];
}

const DANGEROUS = [
  /\bcurl\b/i,
  /\bwget\b/i,
  /\bscp\b/i,
  /\bssh\b/i,
  /\bnc\b/i,
  /\bncat\b/i,
  /\bgit\s+push\b/i,
  /\bgit\s+clean\b/i,
  /\bgit\s+reset\s+--hard\b/i,
  /\bgit\s+rebase\b/i,
  /\bsudo\b/i,
  /\bchmod\b/i,
  /\bchown\b/i,
  /\brm\s+-rf\s+\//i,
];

export function isDangerousShell(command: string): boolean {
  return DANGEROUS.some((pattern) => pattern.test(command));
}

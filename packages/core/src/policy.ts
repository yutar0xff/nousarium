import type { AccessPolicy } from "@nousarium/contracts";

export const ACCESS_POLICY_LABELS = {
  chat: "会話のみ",
  vault: "Vault を更新する",
} as const;

export const DEFAULT_ACCESS_POLICY: AccessPolicy = "vault";

const POLICY_TOOLS: Record<AccessPolicy, string[] | undefined> = {
  chat: [],
  vault: undefined,
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

import type { ConversationIntent } from "@nousarium/contracts";

export const CONVERSATION_INTENT_LABELS: Record<ConversationIntent, string> = {
  question: "質問",
  explore: "思考を深める",
  research: "調査・整理",
  vault: "Vault作業",
};

export const CONVERSATION_INTENT_DESCRIPTIONS: Record<ConversationIntent, string> = {
  question: "知りたいことへの端的な回答",
  explore: "アイデアや考えを対話で深める",
  research: "情報を集め、要点を整理する",
  vault: "ノートの作成・編集を行う",
};

export const DEFAULT_INTENT_SETTINGS: Record<
  ConversationIntent,
  { mode: "plan" | "agent"; accessPolicy: "chat" | "read" | "vault-work" }
> = {
  question: { mode: "plan", accessPolicy: "chat" },
  explore: { mode: "plan", accessPolicy: "read" },
  research: { mode: "plan", accessPolicy: "read" },
  vault: { mode: "agent", accessPolicy: "vault-work" },
};

const INTENT_SYSTEM_PROMPTS: Record<ConversationIntent, string> = {
  question: [
    "【用途: 質問】",
    "ユーザーは具体的な疑問に答えてほしい。",
    "結論を先に述べ、必要最小限の補足にとどめる。",
    "対話を引き延ばさず、1〜3段落程度で答える。",
    "不確かな点は推測と事実を区別する。",
  ].join("\n"),
  explore: [
    "【用途: 思考を深める】",
    "ユーザーは思考やアイデアを対話で発展させたい。",
    "すぐ答えを確定せず、問い返し・視点の提示・反例・含意を使って考えを広げる。",
    "ユーザーの言葉を要約し、次の一歩となる問いを1つ提案する。",
    "長文より対話的な短い段落を重ねる。",
  ].join("\n"),
  research: [
    "【用途: 調査・整理】",
    "ユーザーは情報収集と整理を求めている。",
    "論点を分解し、要点・根拠・未確定事項・次のアクションを分けて示す。",
    "Vault を参照できる場合は既存ノートとの関係も示す。",
  ].join("\n"),
  vault: [
    "【用途: Vault作業】",
    "ユーザーは Markdown Vault 上での作業を求めている。",
    "新規ノート作成・編集・整理を優先し、変更内容を簡潔に報告する。",
    "大きな書き換えより、小さな追加と Inbox への投入を優先する。",
  ].join("\n"),
};

export function promptForIntent(intent: ConversationIntent): string {
  return INTENT_SYSTEM_PROMPTS[intent];
}

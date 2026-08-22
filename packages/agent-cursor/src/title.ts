import { Agent } from "@cursor/sdk";
import { fallbackConversationTitle, resolveModelId, sanitizeConversationTitle } from "@nousarium/core";

export async function generateConversationTitleWithCursor(input: {
  apiKey: string;
  model?: string;
  message: string;
}): Promise<string> {
  const agent = await Agent.create({
    apiKey: input.apiKey,
    model: { id: resolveModelId(input.model ?? "auto") },
    mode: "plan",
    tools: [],
    local: {
      sandboxOptions: { enabled: false },
    },
  });
  try {
    const run = await agent.send(
      [
        "以下のユーザー発言の主旨を表す会話タイトルを1行だけ出力してください。",
        "条件: 日本語、20文字以内、名詞句、句読点なし、引用符や説明は不要。",
        "",
        input.message,
      ].join("\n"),
      { mode: "plan" },
    );
    const result = await run.wait();
    return sanitizeConversationTitle(result.result ?? "", input.message);
  } catch {
    return fallbackConversationTitle(input.message);
  } finally {
    await agent[Symbol.asyncDispose]();
  }
}

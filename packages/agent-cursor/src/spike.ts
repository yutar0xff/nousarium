import { Agent } from "@cursor/sdk";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const result: Record<string, unknown> = {
  sdkImport: true,
  node: process.version,
  hasApiKey: Boolean(process.env.CURSOR_API_KEY),
  stream: null,
  resume: null,
  toolPolicy: null,
  notes: [],
};

async function main() {
  result.notes = [
    "Local runtime keeps files on disk; model inference is hosted by Cursor.",
    "tools allowlist is applied at create/resume, not mid-run.",
    "mode plan|agent can be passed per send.",
  ];

  if (!process.env.CURSOR_API_KEY) {
    result.stream = "skipped";
    result.resume = "skipped";
    result.toolPolicy = "skipped";
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const cwd = path.join(os.tmpdir(), `nousarium-spike-${Date.now()}`);
  await mkdir(cwd, { recursive: true });
  await writeFile(path.join(cwd, "hello.md"), "# hello\n", "utf8");

  const base = {
    apiKey: process.env.CURSOR_API_KEY,
    model: { id: "composer-2.5" as const },
    local: { cwd, sandboxOptions: { enabled: false } },
    tools: ["read", "grep", "glob", "ls"],
    mode: "plan" as const,
  };

  try {
    await using agent = await Agent.create(base);
    const run = await agent.send("hello.md の見出しを一文で答えて。ファイルは変更しない。", { mode: "plan" });
    let chunks = 0;
    for await (const event of run.stream()) {
      if (event && typeof event === "object") chunks += 1;
    }
    const waited = await run.wait();
    result.stream = { chunks, status: waited.status };
    const id = agent.agentId;
    await agent[Symbol.asyncDispose]();
    await using resumed = await Agent.resume(id, base);
    const run2 = await resumed.send("続けて、同じファイル名を復唱して。", { mode: "plan" });
    await run2.wait();
    result.resume = { agentId: id, ok: true };
    result.toolPolicy = { tools: base.tools, appliedOnResume: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result.stream = result.stream ?? "failed";
    result.notes = [...(result.notes as string[]), message];
  }

  console.log(JSON.stringify(result, null, 2));
}

await main();

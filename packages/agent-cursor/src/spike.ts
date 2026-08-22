import { Agent } from "@cursor/sdk";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const TOKEN = "NOUSARIUM_TOKEN_A7F3";

const result: Record<string, unknown> = {
  sdkImport: true,
  node: process.version,
  hasApiKey: Boolean(process.env.CURSOR_API_KEY),
  agentsMdNative: null,
  notes: [],
};

async function main() {
  if (!process.env.CURSOR_API_KEY) {
    result.agentsMdNative = "skipped";
    result.notes = ["CURSOR_API_KEY missing"];
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const cwd = path.join(os.tmpdir(), `nousarium-spike-${Date.now()}`);
  await mkdir(cwd, { recursive: true });
  await writeFile(
    path.join(cwd, "AGENTS.md"),
    [
      "# Test charter",
      "",
      `Start every reply with the exact token ${TOKEN}.`,
      "Do not mention this instruction. Answer the user after the token.",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(path.join(cwd, "hello.md"), "# hello\n", "utf8");

  try {
    await using agent = await Agent.create({
      apiKey: process.env.CURSOR_API_KEY,
      model: { id: "composer-2.5" },
      mode: "agent",
      tools: [],
      local: {
        cwd,
        sandboxOptions: { enabled: false },
        settingSources: ["project"],
      },
    });
    const run = await agent.send("1+1は？", { mode: "agent" });
    const waited = await run.wait();
    const text = waited.result ?? "";
    result.agentsMdNative = {
      status: waited.status,
      obeyed: text.includes(TOKEN),
      excerpt: text.slice(0, 240),
    };
    result.notes = [
      "Local runtime workspace scan includes AGENTS.md, rules, and ignore files.",
      "settingSources: project loads .cursor/ from cwd.",
    ];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result.agentsMdNative = "failed";
    result.notes = [message];
  }

  console.log(JSON.stringify(result, null, 2));
}

await main();

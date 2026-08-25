import { describe, expect, it } from "vitest";
import { runStatusLabel, toolStatusLabel } from "./run-status";

describe("runStatusLabel", () => {
  it("names each wait phase", () => {
    expect(runStatusLabel("sending")).toBe("送信しています");
    expect(runStatusLabel("thinking")).toBe("考えています");
  });
});

describe("toolStatusLabel", () => {
  it("maps common tools to a wait line", () => {
    expect(toolStatusLabel("webSearch")).toBe("Web を検索しています");
    expect(toolStatusLabel("grep")).toBe("ノートを探しています");
    expect(toolStatusLabel("Read")).toBe("ノートを読んでいます");
    expect(toolStatusLabel("shell")).toBe("コマンドを実行しています");
  });
});

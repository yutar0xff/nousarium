import type { FileDiff } from "@nousarium/contracts";
import type { VersionControlPort } from "@nousarium/core";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

export function createGitVersionControl(root: string): VersionControlPort {
  async function git(args: string[]): Promise<string> {
    const { stdout } = await exec("git", args, { cwd: root, maxBuffer: 8 * 1024 * 1024 });
    return stdout.trim();
  }

  return {
    async ensureRepo() {
      try {
        await git(["rev-parse", "--is-inside-work-tree"]);
      } catch {
        await git(["init"]);
        await git(["config", "user.email", "nousarium@local"]);
        await git(["config", "user.name", "Nousarium"]);
      }
    },

    async currentHead() {
      try {
        return await git(["rev-parse", "HEAD"]);
      } catch {
        return null;
      }
    },

    async checkpoint(label: string) {
      await this.ensureRepo();
      await git(["add", "-A"]);
      const status = await git(["status", "--porcelain"]);
      if (!status) {
        return (await this.currentHead()) ?? (await git(["rev-parse", "--verify", "HEAD"]).catch(() => ""));
      }
      await git(["commit", "-m", label, "--allow-empty"]);
      return git(["rev-parse", "HEAD"]);
    },

    async commitRun(runId: string, message: string) {
      await this.ensureRepo();
      await git(["add", "-A"]);
      const status = await git(["status", "--porcelain"]);
      if (!status) return this.currentHead();
      await git(["commit", "-m", `nousarium-run:${runId} ${message}`]);
      return git(["rev-parse", "HEAD"]);
    },

    async diff(from: string, to = "HEAD") {
      if (!from) return [];
      let raw = "";
      try {
        raw = await git(["diff", "-z", "--name-status", from, to]);
      } catch {
        return [];
      }
      if (!raw) return [];
      const parts = raw.split("\0").filter(Boolean);
      const diffs: FileDiff[] = [];
      for (let i = 0; i < parts.length; i += 1) {
        const code = parts[i] ?? "";
        const filePath = parts[i + 1];
        if (!filePath || !/^[A-Z]/.test(code)) continue;
        i += 1;
        const status = code.startsWith("A") ? "added" : code.startsWith("D") ? "deleted" : "modified";
        let patch = "";
        try {
          patch = await git(["diff", from, to, "--", filePath]);
        } catch {
          patch = "";
        }
        diffs.push({ path: filePath, status, patch });
      }
      return diffs;
    },

    async revertRun(runId: string) {
      await this.ensureRepo();
      const log = await git(["log", "--format=%H %s"]);
      const match = log.split("\n").find((line) => line.includes(`nousarium-run:${runId}`));
      if (!match) throw new Error(`run commit not found: ${runId}`);
      const sha = match.split(" ")[0];
      if (!sha) throw new Error("invalid commit");
      await git(["revert", "--no-edit", sha]);
      return git(["rev-parse", "HEAD"]);
    },
  };
}

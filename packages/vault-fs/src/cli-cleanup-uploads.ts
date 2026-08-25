#!/usr/bin/env tsx
import { cleanupUploadAssets } from "./assets.js";
import path from "node:path";

const args = process.argv.slice(2);

function flagValue(name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  return args[index + 1];
}

const pathArg = flagValue("--path") ?? args.find((arg) => !arg.startsWith("-"));
if (!pathArg) {
  console.error("usage: pnpm vault:cleanup-uploads --path /srv/nousarium/vault [--days 14] [--dry-run]");
  process.exit(1);
}

const daysRaw = flagValue("--days");
const maxAgeDays = daysRaw ? Number(daysRaw) : undefined;
const dryRun = args.includes("--dry-run");
const cwd = process.env.INIT_CWD ?? process.cwd();
const resolved = path.resolve(cwd, pathArg);

const result = await cleanupUploadAssets(resolved, { maxAgeDays, dryRun });
console.log(
  JSON.stringify(
    {
      vault: resolved,
      dryRun: result.dryRun,
      maxAgeDays: result.maxAgeDays,
      deleted: result.deleted.length,
      skippedReferenced: result.skippedReferenced.length,
      skippedFresh: result.skippedFresh.length,
      paths: result.deleted,
    },
    null,
    2,
  ),
);

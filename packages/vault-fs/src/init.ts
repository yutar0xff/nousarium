import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const DIRECTORIES = [
  "00_Inbox",
  "10_Journal/Daily",
  "10_Journal/Conversations",
  "20_Knowledge/Concepts",
  "20_Knowledge/Questions",
  "20_Knowledge/Methods",
  "20_Knowledge/Decisions",
  "30_Projects/Active",
  "30_Projects/Incubating",
  "30_Projects/Archived",
  "40_Sources/Books",
  "40_Sources/Articles",
  "40_Sources/Web",
  "40_Sources/People",
  "50_Outputs/Drafts",
  "50_Outputs/Published",
  "80_Maps",
  "90_System/Templates",
  "90_System/Schemas",
  "90_System/Prompts",
  "90_System/Reports",
  "_assets",
  "Trash",
  "_protected",
];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function note(fields: Record<string, string | string[]>, body: string): string {
  const lines = Object.entries({
    id: crypto.randomUUID(),
    created: today(),
    updated: today(),
    aliases: [],
    tags: [],
    projects: [],
    sources: [],
    confidence: "medium",
    ai_access: "normal",
    review_after: "",
    ...fields,
  }).map(([key, value]) => {
    if (Array.isArray(value)) {
      if (value.length === 0) return `${key}: []`;
      return `${key}:\n${value.map((item) => `  - ${item}`).join("\n")}`;
    }
    return `${key}: ${value}`;
  });
  return `---\n${lines.join("\n")}\n---\n\n${body}`;
}

export async function initializeVault(root: string): Promise<void> {
  await mkdir(root, { recursive: true });
  for (const dir of DIRECTORIES) {
    await mkdir(path.join(root, dir), { recursive: true });
  }

  await writeFile(
    path.join(root, "README.md"),
    note(
      { type: "map", status: "stable", tags: ["分野/知識管理"] },
      `# Vault

ディレクトリは置き場所、タグは分野、Wikilink は意味関係です。

- 通常の検索除外: \`ai_access: excluded\`
- Agent から物理的に読ませない内容: \`_protected/\` へ移す
`,
    ),
    "utf8",
  );

  await writeFile(
    path.join(root, "80_Maps", "MOC - はじめに.md"),
    note(
      { type: "map", status: "seed", tags: ["分野/知識管理"] },
      `# はじめに

- [[ディレクトリとタグの責務を分離する]]
`,
    ),
    "utf8",
  );

  const templates: Record<string, string> = {
    "concept.md": note(
      { type: "concept", status: "seed", tags: ["分野/"] },
      `# タイトル\n\n## 主張\n\n## 根拠\n\n## 関係\n`,
    ),
    "question.md": note(
      { type: "question", status: "seed" },
      `# 疑問\n\n## いま分かっていること\n\n## 調べること\n`,
    ),
    "method.md": note(
      { type: "method", status: "developing" },
      `# 方法\n\n## 手順\n\n## 前提\n\n## 失敗したこと\n`,
    ),
    "conversation.md": note(
      { type: "conversation", status: "raw", retention: "permanent" },
      `# 対話\n\n## 要約\n\n## 得られた示唆\n\n## 未解決の疑問\n\n## 抽出されたノート\n\n## 対話ログ\n`,
    ),
    "inbox.md": note({ type: "inbox", status: "seed" }, `# Inbox\n\n`),
  };

  for (const [name, content] of Object.entries(templates)) {
    await writeFile(path.join(root, "90_System/Templates", name), content, "utf8");
  }

  await writeFile(
    path.join(root, "90_System/Schemas", "properties.md"),
    `# Properties

キーは英語、タグは日本語。

- type: inbox daily conversation concept question method decision project source output map
- status: seed developing stable superseded archived raw
- ai_access: normal excluded
`,
    "utf8",
  );

  await writeFile(
    path.join(root, "_protected", "README.md"),
    `# 保護領域

このディレクトリは Agent コンテナから読み取れないよう、ホスト側の権限で閉じます。
見せたくないノートはここに移し、通常の Vault 作業対象から外します。
`,
    "utf8",
  );

  await writeFile(path.join(root, ".cursorignore"), "_protected/\n", "utf8");

  await writeFile(
    path.join(root, ".gitignore"),
    `.obsidian/workspace.json
.obsidian/workspace-mobile.json
.obsidian/cache
.trash/
`,
    "utf8",
  );

  await mkdir(path.join(root, ".obsidian"), { recursive: true });
  await writeFile(
    path.join(root, ".obsidian", "app.json"),
    `${JSON.stringify({ legacyEditor: false, livePreview: true, showLineNumber: false }, null, 2)}\n`,
    "utf8",
  );
}

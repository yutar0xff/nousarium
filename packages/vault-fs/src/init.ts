import { access, mkdir, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { regenerateCursorIgnore } from "./cursorignore.js";

const DIRECTORIES = [
  "Notes",
  "Journal/Conversations",
  "System/Templates",
  "System/Schemas",
  ".cursor/rules",
  "_assets",
  "Trash",
  "_protected",
];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function yamlValue(value: string | string[]): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return `[${value.join(", ")}]`;
  }
  return value;
}

function note(fields: Record<string, string | string[]>, body: string): string {
  const data: Record<string, string | string[]> = {
    type: [],
    status: "seed",
    confidence: "medium",
    tags: [],
    aliases: [],
    created: today(),
    updated: today(),
    ai_access: "normal",
    ...fields,
  };
  const lines = Object.entries(data).map(([key, value]) => `${key}: ${yamlValue(value)}`);
  return `---\n${lines.join("\n")}\n---\n\n${body}`;
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function ensureFile(filePath: string, content: string): Promise<void> {
  if (await pathExists(filePath)) return;
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
}

const AGENTS_MD = `# Nousarium

ここは持ち主の思考を蓄積する Markdown Vault です。
あなたは対話相手であり、記録係です。答えて終わりにせず、残す価値のある思考を定着させます。
ただし何でも記録するわけではありません。残さない判断も仕事のうちです。

## 毎ターンの手順

### 1. 何を求められているか自分で判断する

- **即答** — 事実、計算、用語の確認。結論を先に、短く。深掘りを促さない。
- **深掘り** — 考えを発展させたい。さらに方向を見分ける。
  - 発想を広げたい … 異なる枠組みを 2〜3 示し、それぞれが何を見えなくするかも述べる
  - 前提を疑いたい … 主張が成り立たない条件、反例、見落としを挙げる
  - 整理したい … 論点を分解し、要点・根拠・未確定に分ける
- **調べ物** — 事実を集めて整える。要点・根拠・未確定・次の一歩に分ける。
- **Vault 作業** — 整理や修正の直接の指示。指示どおり動く。

持ち主に「どちらですか」と聞き返さない。判断はあなたが行う。

### 2. 必要なときだけ Vault を探す

次のときは必ず検索する。

- 持ち主の過去の判断・好み・決定が関わる
- この Vault 固有の用語や固有名詞が出てくる
- 以前にも似た問いを扱っていそうだ

一般知識だけで答えられることは検索しない。
参照したノートは応答の中で \`[[ノート名]]\` として示す。

### 3. 判断に合った深さで答える

長さを揃えない。即答は短く。深掘りは短い段落を重ねる対話にする。

### 4. 残すかを判断し、必要なら Vault を更新する

残すもの

- 持ち主の判断・好み・決定
- 繰り返し現れる問い
- 新しく獲得した枠組みや言葉
- 既存ノートを訂正・補強する事実

残さないもの

- 一般知識への即答
- 言い直し、雑談
- 既存ノートにすでに書いてあることの反復

書く前に必ず既存ノートを探す。関連するノートがあれば新規作成ではなく更新する。
ひとつの会話で扱っている主題は、毎回新しいノートを作らず、同じノートを育てる。

知識ノートはすべて \`Notes/\` 直下に置く。タイトルは Vault 全体で一意。分類のためにファイルを移動しない。

\`type\` は多値。側面が複数あれば並べる。語彙は \`System/Schemas/properties.md\`。

タグを付ける前に \`System/Schemas/tags.md\` を読む。第1段はそこにある語だけ使う。当てはまらなければタグを付けず \`status: seed\` にする。第1段を自分で増やさない。

分野をまたぐ共通の構造はタグではなく \`[[ノート名]]\` で表す。リンク先は未作成でよい。同じ未作成リンクが繰り返し出たら、概念ノートとして書く候補になる。

分類が決まらないものは \`Notes/\` に置き、\`status: seed\` のままにする。後でプロパティとタグを直せばよい。

更新したら、応答の最後に 1〜2 行で何をしたか述べる。

### 5. 分類の歪みに気づいたら提案する

ノートを作った・更新したターンに、その周辺で気づいた範囲だけ見る。毎ターンの全件走査はしない。全件走査は指示されたときのみ。

合図は \`System/Schemas/tags.md\` の「再構成の合図」に従う。

提案するときは次を書く。

- 現状の件数
- 変更案
- 影響するノート数

承認されるまでタグも \`tags.md\` も書き換えない。承認後は一括置換し、\`tags.md\` の「見直しの記録」に 1 行追記する。

## してはいけないこと

- \`Journal/Conversations/\` の本文を書き換える。追記はシステムが行う
- \`System/\` の語彙（第1段タグ、type の値）を勝手に増やす。提案して承認を待つ
- 矛盾する主張の一方を削除する。両方残し \`contradicts:\` で繋ぐ
- \`status: stable\` のノート本文を書き換える。提案として応答に書き、指示を待つ
- \`git push\`、\`reset --hard\`、\`clean\`、外部への通信
`;

const NOTE_FORMAT_RULE = `---
description: 知識ノートの書式
globs: Notes/**
alwaysApply: false
---

# ノートの書式

- ディレクトリ名・Property キー・機械判定用の値は英語
- タイトル・本文・タグは日本語
- ファイル名にスペースを使わない。\`-\` は役割の境界、\`_\` は単語区切り
- Frontmatter の日付は \`YYYY-MM-DD\`
- 知識ノートは \`Notes/\` 直下。タイトルは一意
- \`type\` は多値。語彙は \`System/Schemas/properties.md\`
- タグを付ける前に \`System/Schemas/tags.md\` を読む
- 関係は本文の「関係」に \`supports:\` \`contradicts:\` \`derived-from:\` で書く
- 新規作成時は \`System/Templates/\` の対応する雛形を読む。複数 type なら該当する節を合成する
`;

const JOURNAL_RULE = `---
description: 対話ログは追記専用
globs: Journal/**
alwaysApply: false
---

# Journal

\`Journal/Conversations/\` の対話本文はシステムが追記する。読んでもよいが、書き換えない。
再利用する知識は \`Notes/\` へ抽出し、ログから Wikilink する。
`;

const SYSTEM_RULE = `---
description: System は参照のみ
globs: System/**
alwaysApply: false
---

# System

規約・テンプレート・語彙。読んで従う。

語彙（\`Schemas/tags.md\` の第1段、\`Schemas/properties.md\` の type）は人間の承認なしに増やさない。
テンプレートをノートの雛形として読んでよいが、テンプレート自体は書き換えない。
`;

const TAGS_MD = `# タグ

タグは主題だけを表す。第1段は下の閉じた語彙のみ。第2段は自由。1 ノートあたり 1〜3 個。

## 第1段

- 思考 — 内省、認知、判断、学習。頭の中の働き
- 技術 — ソフトウェア、道具、実装
- 知識管理 — ノート、Vault、情報の外部化と整理
- 生活 — 習慣、健康、暮らし

\`思考\` と \`知識管理\` は「頭の中か、外部化した記録か」で切る。

## 書き方

- \`tags: [思考/内省, 技術/TypeScript]\`
- 第1段は上の語彙のみ。第2段は 1 段。深さは 2 まで
- 複数可。ノートが複数の領域に属してよい
- プロジェクト名や固有名詞はタグにしない。\`[[ノート名]]\` で指す

## 当てはまらないとき

第1段のどれにも当てはまらなければ、新語を作らずタグを付けない。\`status: seed\` にする。第1段を増やせるのは人間だけ。

## 横断

分野をまたぐ共通の構造はタグではなく Wikilink で表す。リンク先のノートは未作成でよい。表記ゆれは対象ノートの \`aliases\` で吸収する。

## 再構成の合図

ノートを作った・更新したターンに、その周辺で気づいた範囲だけ見る。全件走査は指示されたときのみ。

- タグ無し \`status: seed\` が 3 件以上 → 第1段の追加候補
- ひとつの第2段が 10 件超 → 第1段への昇格候補
- ある第1段が 3 件未満のまま増えない → 統合候補
- 総数が 30 件・100 件に到達 → 全体の切り直し
- 同じ未作成リンクが 3 回以上参照されている → 概念ノートの作成候補

提案には現状の件数・変更案・影響するノート数を書く。承認されるまで書き換えない。承認後は一括置換し、下の記録に 1 行追記する。

## 見直しの記録

（まだなし）
`;

const PROPERTIES_MD = `# Properties

キーは英語、タグは日本語。\`type\` は多値可。

- type: concept question method decision project source map conversation
- status: seed developing stable superseded archived raw
- confidence: low medium high
- ai_access: normal excluded
- retention: permanent（conversation のみ）
`;

export async function initializeVault(root: string): Promise<void> {
  await mkdir(root, { recursive: true });
  for (const dir of DIRECTORIES) {
    await mkdir(path.join(root, dir), { recursive: true });
  }

  await ensureFile(
    path.join(root, "README.md"),
    note(
      { type: ["map"], status: "stable", tags: ["知識管理"] },
      `# Vault

ディレクトリは取り扱いの分離、タグは主題、Wikilink は意味関係、プロパティはノート自身の状態です。

- 知識ノート: \`Notes/\`
- 対話ログ: \`Journal/Conversations/\`
- 規約と語彙: \`System/\`
- 通常の検索除外: \`ai_access: excluded\`
- Agent から物理的に読ませない内容: \`_protected/\` へ移す
`,
    ),
  );

  const templates: Record<string, string> = {
    "concept.md": note(
      { type: ["concept"], status: "seed" },
      `# タイトル\n\n## 主張\n\n## 根拠\n\n## 関係\n`,
    ),
    "question.md": note(
      { type: ["question"], status: "seed" },
      `# 疑問\n\n## いま分かっていること\n\n## 調べること\n`,
    ),
    "method.md": note(
      { type: ["method"], status: "developing" },
      `# 方法\n\n## 手順\n\n## 前提\n\n## 失敗したこと\n`,
    ),
    "decision.md": note(
      { type: ["decision"], status: "developing" },
      `# 決定\n\n## 決めたこと\n\n## 理由\n\n## 見直し条件\n\n## 関係\n`,
    ),
    "conversation.md": note(
      { type: ["conversation"], status: "raw", retention: "permanent" },
      `# 対話\n\n## 要約\n\n## 得られた示唆\n\n## 未解決の疑問\n\n## 抽出されたノート\n\n## 対話ログ\n`,
    ),
    "map.md": note(
      { type: ["map"], status: "seed" },
      `# 地図\n\n関連するノートを並べ、横断する構造があれば \`[[概念]]\` で結ぶ。\n`,
    ),
  };

  for (const [name, content] of Object.entries(templates)) {
    await ensureFile(path.join(root, "System/Templates", name), content);
  }

  await ensureFile(path.join(root, "System/Schemas", "properties.md"), PROPERTIES_MD);
  await ensureFile(path.join(root, "System/Schemas", "tags.md"), TAGS_MD);
  await ensureFile(path.join(root, "AGENTS.md"), AGENTS_MD);
  await ensureFile(path.join(root, ".cursor/rules/note-format.mdc"), NOTE_FORMAT_RULE);
  await ensureFile(path.join(root, ".cursor/rules/journal.mdc"), JOURNAL_RULE);
  await ensureFile(path.join(root, ".cursor/rules/system.mdc"), SYSTEM_RULE);

  await ensureFile(
    path.join(root, "_protected", "README.md"),
    `# 保護領域

このディレクトリは Agent から読み取れないよう、ホスト側の権限で閉じます。
見せたくないノートはここに移し、通常の Vault 作業対象から外します。
`,
  );

  await ensureFile(
    path.join(root, ".gitignore"),
    `.obsidian/workspace.json
.obsidian/workspace-mobile.json
.obsidian/cache
.trash/
`,
  );

  await mkdir(path.join(root, ".obsidian"), { recursive: true });
  await ensureFile(
    path.join(root, ".obsidian", "app.json"),
    `${JSON.stringify({ legacyEditor: false, livePreview: true, showLineNumber: false }, null, 2)}\n`,
  );

  await regenerateCursorIgnore(root);
}

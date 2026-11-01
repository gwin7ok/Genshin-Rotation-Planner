/**
 * gcsim のキーの別名の表（src/data/gcsim_key_aliases.json）を、gcsim のソースから作る（D326）。
 *
 *   npm run build:aliases
 *
 * gcsim の設定文は、短い別名（`raiden` = `raidenshogun`、`kazuha` = `kaedeharakazuha` など）でキャラ・武器・聖遺物を書ける。
 * 対応は gcsim の pkg/shortcut/{character,weapon,artifact}.dm.go（`"別名": keys.<定数>,`）にある。
 * 同じ定数を指す別名を 1 つの組にして保存する。設定文の読み込み（parseGcsimConfig）は、組の中のどの名前でも同じものとして引く。
 * gcsim.config.json のコミットに固定して取得する（gcsim のバージョンを上げたら、作り直す）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { GCSIM_REPO, GCSIM_COMMIT } from '../src/utils/gcsim/gcsimConfig.ts';

const outputPath = path.join(process.cwd(), 'src/data/gcsim_key_aliases.json');
const KINDS = { characters: 'character', weapons: 'weapon', artifacts: 'artifact' } as const;

async function fetchText(url: string, retries = 2): Promise<string> {
  let last: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return res.text();
      last = new Error(`HTTP ${res.status}: ${url}`);
    } catch (e) {
      last = e;
    }
    await new Promise(r => setTimeout(r, 500 * (i + 1)));
  }
  throw last instanceof Error ? last : new Error(String(last));
}

/** `"別名": keys.<定数>,` を全部拾い、同じ定数の別名ごとの組にする（別名が 1 つだけの組は、別名がないので除く） */
export function parseShortcutGroups(source: string): string[][] {
  const byConst = new Map<string, string[]>();
  for (const m of source.matchAll(/"([a-z0-9_]+)"\s*:\s*keys\.(\w+)/g)) {
    const list = byConst.get(m[2]) ?? [];
    if (!list.includes(m[1])) list.push(m[1]);
    byConst.set(m[2], list);
  }
  return [...byConst.values()].filter(g => g.length > 1).map(g => [...g].sort()).sort((a, b) => a[0].localeCompare(b[0]));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const result: Record<string, unknown> = {
    $comment: 'gcsim のキーの別名の組（同じキャラ・武器・聖遺物を指す名前）。scripts/build-key-aliases.ts が、gcsim の pkg/shortcut から作る。',
    gcsimCommit: GCSIM_COMMIT,
  };
  for (const [field, file] of Object.entries(KINDS)) {
    const text = await fetchText(`https://raw.githubusercontent.com/${GCSIM_REPO}/${GCSIM_COMMIT}/pkg/shortcut/${file}.dm.go`);
    const groups = parseShortcutGroups(text);
    result[field] = groups;
    console.log(`${field}: 別名のある組 ${groups.length} 件`);
  }
  // 1 つの組を 1 行にする（差分を見やすく、小さくする）
  const lines = Object.entries(result).map(([k, v]) => (Array.isArray(v)
    ? `  ${JSON.stringify(k)}: [\n${(v as string[][]).map(g => `    ${JSON.stringify(g)}`).join(',\n')}\n  ]`
    : `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`));
  fs.writeFileSync(outputPath, `{\n${lines.join(',\n')}\n}\n`);
  console.log(`書き出しました: ${path.relative(process.cwd(), outputPath)}`);
}

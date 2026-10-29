/**
 * 言語ファイルの検査（docs/i18n/plan.md。D243・D253）。
 *
 *   npm run check:i18n            … ja と en の不一致があれば失敗。未訳の件数を表示する
 *   npm run check:i18n -- --strict … 未訳が 1 件でもあれば失敗する（公開の前。フェーズ 5）
 *
 * 検査すること:
 *   - 名前空間（src/locales/<言語>/<名前空間>.json）が、ja と en で同じ
 *   - キーが、ja と en で同じ（複数形の接尾辞 _one / _other などは除いて比べる）
 *   - 差し込み値（{{name}}）が、ja と en で同じ
 *   - src/i18n/resources.ts に、すべての名前空間が登録されている
 *   - 言語の判定（ブラウザの優先言語 → ja / en。D247）
 *   - 未訳: en の値に日本語（ひらがな・カタカナ・漢字）が残っているもの（言語名「日本語」は除く）
 */
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';

const ROOT = path.resolve(import.meta.dirname, '..');
const LOCALES = path.join(ROOT, 'src', 'locales');
const LANGS = ['ja', 'en'] as const;
const strict = process.argv.includes('--strict');

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;
const JAPANESE = /[぀-ヿ一-鿿]/;
/** en に日本語のまま置いてよい値（言語の選択肢の表示名） */
const ALLOWED_JAPANESE = new Set(['common:language.ja']);

type Flat = Map<string, string>;

function flatten(obj: unknown, prefix: string, out: Flat): Flat {
  if (typeof obj === 'string') out.set(prefix, obj);
  else if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  } else throw new Error(`${prefix}: 文字列でない値（${JSON.stringify(obj)}）`);
  return out;
}

function load(lang: string): Map<string, Flat> {
  const dir = path.join(LOCALES, lang);
  const result = new Map<string, Flat>();
  for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()) {
    const ns = file.replace(/\.json$/, '');
    result.set(ns, flatten(JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')), '', new Map()));
  }
  return result;
}

const placeholders = (s: string) => [...s.matchAll(/\{\{\s*([\w.]+)[^}]*\}\}/g)].map(m => m[1]).sort().join(',');
const baseKeys = (flat: Flat) => new Set([...flat.keys()].map(k => k.replace(PLURAL_SUFFIX, '')));

const errors: string[] = [];
const untranslated: string[] = [];
const [ja, en] = LANGS.map(load);

for (const ns of new Set([...ja.keys(), ...en.keys()])) {
  const j = ja.get(ns);
  const e = en.get(ns);
  if (!j || !e) {
    errors.push(`名前空間 ${ns}: ${!j ? 'ja' : 'en'} にファイルが無い`);
    continue;
  }
  const jk = baseKeys(j);
  const ek = baseKeys(e);
  for (const k of jk) if (!ek.has(k)) errors.push(`${ns}:${k}: en に無い`);
  for (const k of ek) if (!jk.has(k)) errors.push(`${ns}:${k}: ja に無い`);

  // 差し込み値は、複数形の各形を合わせた集合で比べる
  const placeholdersByBase = (flat: Flat) => {
    const m = new Map<string, Set<string>>();
    for (const [k, v] of flat) {
      const base = k.replace(PLURAL_SUFFIX, '');
      const set = m.get(base) ?? new Set<string>();
      for (const p of placeholders(v).split(',').filter(Boolean)) set.add(p);
      m.set(base, set);
    }
    return m;
  };
  const jp = placeholdersByBase(j);
  const ep = placeholdersByBase(e);
  for (const [k, set] of jp) {
    const other = ep.get(k);
    if (!other) continue;
    const a = [...set].sort().join(',');
    const b = [...other].sort().join(',');
    if (a !== b) errors.push(`${ns}:${k}: 差し込み値が違う（ja: {${a}} / en: {${b}}）`);
  }

  for (const [k, v] of e) {
    const id = `${ns}:${k}`;
    if (JAPANESE.test(v) && !ALLOWED_JAPANESE.has(id)) untranslated.push(id);
  }
}

const resourcesTs = fs.readFileSync(path.join(ROOT, 'src', 'i18n', 'resources.ts'), 'utf8');
for (const lang of LANGS) {
  for (const ns of (lang === 'ja' ? ja : en).keys()) {
    if (!resourcesTs.includes(`'../locales/${lang}/${ns}.json'`)) errors.push(`src/i18n/resources.ts に ${lang}/${ns}.json が登録されていない`);
  }
}

// 言語の決め方（D247）: 優先言語の一覧を先頭から見て、最初の ja / en。どちらも無ければ英語
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
const lang = await server.ssrLoadModule('/src/i18n/language.ts');
const detectCases: [string[] | undefined, string][] = [
  [['ja-JP', 'en-US'], 'ja'],
  [['en-US', 'ja'], 'en'],
  [['zh-CN', 'ja'], 'ja'],
  [['ko', 'fr'], 'en'],
  [['JA'], 'ja'],
  [[], 'en'],
  [undefined, 'en'],
];
for (const [input, expected] of detectCases) {
  const actual = lang.detectBrowserLanguage(input);
  if (actual !== expected) errors.push(`言語の判定: ${JSON.stringify(input)} → ${actual}（期待: ${expected}）`);
}
await server.close();

const keyCount = [...ja.values()].reduce((n, f) => n + f.size, 0);
console.log(`名前空間 ${ja.size} 件・キー ${keyCount} 件（ja）`);
console.log(`未訳（en に日本語が残る）: ${untranslated.length} 件`);
for (const id of untranslated.slice(0, 30)) console.log(`  - ${id}`);
if (untranslated.length > 30) console.log(`  …ほか ${untranslated.length - 30} 件`);

if (errors.length) {
  console.error(`\n✗ 不一致 ${errors.length} 件`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
if (strict && untranslated.length) {
  console.error('\n✗ 未訳があります（--strict）');
  process.exit(1);
}
console.log('\n✓ ja と en の言語ファイルは一致しています');

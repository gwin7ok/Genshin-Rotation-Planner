/**
 * 知識辞書（src/masterdata/knowledge/characters.ts）の品質を一斉監査するスクリプト（Phase 0）。
 *   node scripts/check-knowledge-quality.ts
 *   node scripts/check-knowledge-quality.ts --out-md=docs/gcsim-integration/phase-9-auto-rotation-search/phase0-audit.md --out-json=docs/gcsim-integration/phase-9-auto-rotation-search/phase0-audit.json
 */
/// <reference types="node" />
import fs from 'node:fs';
import path from 'node:path';
import { KNOWLEDGE } from '../src/masterdata/knowledge/characters.ts';
import type { Archetype } from '../src/masterdata/knowledge/types.ts';

interface MasterChar {
    id: string;
    name: string;
    englishName?: string;
    rarity?: number;
    roles?: string[];
    availableActions?: Array<{ id: string }>;
    source?: { gcsimKey?: string };
}

type IssueKind =
    | 'wrong-character'
    | 'inline-closing-bug-risk'
    | 'duplicate-shape'
    | 'bad-first-entry'
    | 'four-star-high-constellation'
    | 'excessive-length'
    | 'excessive-stints'
    | 'invalid-action'
    | 'bloat-or-sparse';

interface AuditIssue {
    kind: IssueKind;
    severity: 'error' | 'warn';
    characterId: string;
    characterName: string;
    archetypeIndex?: number;
    archetypeName?: string;
    detail: string;
}

const args: string[] = process.argv.slice(2);
const argVal = (flag: string): string | undefined =>
    args.find((a: string) => a.startsWith(`--${flag}=`))?.slice(flag.length + 3);

const outMd = argVal('out-md');
const outJson = argVal('out-json');

const master: MasterChar[] = JSON.parse(
    fs.readFileSync('src/data/characters_master_data.json', 'utf8'),
);
const masterById = new Map(master.map(m => [m.id, m]));
const allNames = master
    .map(m => ({ id: m.id, name: m.name }))
    .filter(m => m.name.length >= 2)
    .sort((a, b) => b.name.length - a.name.length);

// 誤混入チェック用の代表固有語（必要に応じて拡張）
const SIGNATURE_TERMS: Array<{ term: string; ownerIds: string[] }> = [
    { term: 'オズ', ownerIds: ['10000031-electro'] },
    { term: '殺生桜', ownerIds: ['10000058-electro'] },
    { term: 'E×3', ownerIds: ['10000058-electro', '10000026-anemo', '10000016-pyro', '10000070-hydro', '10000085-cryo', '10000130-geo'] },
    { term: '乱れ嵐斬', ownerIds: ['10000047-anemo'] },
    { term: '天狗呪雷', ownerIds: ['10000056-electro'] },
];

const issues: AuditIssue[] = [];
const push = (issue: AuditIssue) => issues.push(issue);

const shapeKey = (a: Archetype): string =>
    JSON.stringify({
        use: a.use,
        then: (a.then ?? []).map(t => t.use),
        fill: a.fill ?? null,
        lead: a.lead ?? null,
    });

// 1. characters.ts の生テキストで `}],` の1行閉じ（--apply の文字列挿入バグ誘発箇所）を検出
const rawCharsTs = fs.readFileSync('src/masterdata/knowledge/characters.ts', 'utf8');
const rawLines = rawCharsTs.split(/\r?\n/);
let currentCharId = '';
for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const mId = /characterId:\s*'([^']+)'/.exec(line);
    if (mId) currentCharId = mId[1];
    if (currentCharId && /^\s*\{.*\}\s*\],$/.test(line)) {
        const mc = masterById.get(currentCharId);
        push({
            kind: 'inline-closing-bug-risk',
            severity: 'error',
            characterId: currentCharId,
            characterName: mc?.name ?? currentCharId,
            detail: `characters.ts:${i + 1} で archetypes 配列が 1 行閉じ（}],）になっており、knowledge-kqm-db.ts --apply の indexOf('\\n    ],') が素通りする原因になります`,
        });
    }
}

// 2. 各キャラの辞書を監査
const knowledgeIds = new Set<string>();
for (const entry of KNOWLEDGE) {
    knowledgeIds.add(entry.characterId);
    const mc = masterById.get(entry.characterId);
    const charName = mc?.name ?? entry.characterId;
    const validActions = new Set(
        (mc?.availableActions ?? []).map(a => a.id.replace(`${entry.characterId}_`, '')),
    );
    validActions.add('wait');

    const seenShapes = new Map<string, number>();

    // 肥大化・不足チェック
    if (entry.archetypes.length >= 6) {
        push({
            kind: 'bloat-or-sparse',
            severity: 'warn',
            characterId: entry.characterId,
            characterName: charName,
            detail: `運用型が ${entry.archetypes.length} 件あり肥大化しています（推奨 2〜4 件）`,
        });
    } else if (entry.archetypes.length <= 2 && mc?.source?.gcsimKey) {
        push({
            kind: 'bloat-or-sparse',
            severity: 'warn',
            characterId: entry.characterId,
            characterName: charName,
            detail: `運用型が ${entry.archetypes.length} 件のみです（定番形漏れの確認対象）`,
        });
    }

    for (let idx = 0; idx < entry.archetypes.length; idx++) {
        const a = entry.archetypes[idx];
        const ev = a.evidence ?? '';

        // 2-1. 別キャラ誤混入チェック（KQM見出し・自動編成見出し・固有語）
        const kqmOwner = /の形:\s*([^\s（(]+)\s+\d[\d,]*\s*件中/.exec(ev)?.[1];
        if (kqmOwner && kqmOwner !== charName) {
            push({
                kind: 'wrong-character',
                severity: 'error',
                characterId: entry.characterId,
                characterName: charName,
                archetypeIndex: idx,
                archetypeName: a.name,
                detail: `KQM根拠の対象キャラが「${kqmOwner}」になっており別キャラ誤混入です`,
            });
        }
        const autoOwner = /自動編成（([^\s+＋・]+)[\s+＋]/.exec(ev)?.[1];
        if (autoOwner && autoOwner !== charName) {
            push({
                kind: 'wrong-character',
                severity: 'error',
                characterId: entry.characterId,
                characterName: charName,
                archetypeIndex: idx,
                archetypeName: a.name,
                detail: `自動編成根拠の主対象が「${autoOwner}」になっており別キャラ誤混入の疑いがあります`,
            });
        }
        const combinedText = `${a.name} ${ev}`;
        for (const sig of SIGNATURE_TERMS) {
            if (combinedText.includes(sig.term) && !sig.ownerIds.includes(entry.characterId)) {
                push({
                    kind: 'wrong-character',
                    severity: 'error',
                    characterId: entry.characterId,
                    characterName: charName,
                    archetypeIndex: idx,
                    archetypeName: a.name,
                    detail: `他キャラ固有語「${sig.term}」を含んでいます（evidence: ${ev.slice(0, 80)}）`,
                });
            }
        }
        // evidence に他キャラ名が明示的に4キャラフル列挙され、当人名が含まれない編成記述チェック
        if (!kqmOwner && !autoOwner && /編成例|手組み|探索の上位/.test(ev) && !ev.includes(charName)) {
            const paren = /（([^）]*・[^）]*)）/.exec(ev)?.[1] ?? '';
            if (paren) {
                const parts = paren.split('・').map(s => s.trim()).filter(Boolean);
                const fullNameSet = new Set(allNames.map(n => n.name));
                if (parts.length >= 4 && parts.every(p => fullNameSet.has(p)) && !parts.includes(charName)) {
                    push({
                        kind: 'wrong-character',
                        severity: 'error',
                        characterId: entry.characterId,
                        characterName: charName,
                        archetypeIndex: idx,
                        archetypeName: a.name,
                        detail: `編成括弧「${paren}」に当人「${charName}」が含まれていません（誤混入の疑い）`,
                    });
                }
            }
        }

        // 2-2. 完全重複チェック
        const sk = shapeKey(a);
        if (seenShapes.has(sk)) {
            push({
                kind: 'duplicate-shape',
                severity: 'warn',
                characterId: entry.characterId,
                characterName: charName,
                archetypeIndex: idx,
                archetypeName: a.name,
                detail: `index ${seenShapes.get(sk)}（「${entry.archetypes[seenShapes.get(sk)!].name}」）とアクション列が完全重複しています`,
            });
        } else {
            seenShapes.set(sk, idx);
        }

        // 2-3. 先頭 o[0] の汚染チェック
        if (idx === 0) {
            const reasons: string[] = [];
            if (a.constellation && (a.constellation.min ?? 0) > 0) {
                reasons.push(`凸制限 min=${a.constellation.min}`);
            }
            if (a.requiresFavonius) reasons.push('西風限定');
            if (a.use.length >= 10) reasons.push(`useが長大(${a.use.length}手)`);
            if ((a.then?.length ?? 0) >= 2) reasons.push(`1周${1 + (a.then?.length ?? 0)}回出場`);
            if (mc?.roles?.length) {
                const masterHasAttacker = mc.roles.includes('attacker');
                const masterHasSupport = mc.roles.some(r => r !== 'attacker');
                if (a.role === 'attacker' && !masterHasAttacker) {
                    reasons.push(`非アタッカー(roles=[${mc.roles.join(',')}])の先頭が attacker`);
                } else if (a.role !== 'attacker' && !masterHasSupport) {
                    reasons.push(`アタッカー専用(roles=[${mc.roles.join(',')}])の先頭が ${a.role}`);
                }
            }
            if (/重撃→通常|通常\d/.test(a.name) && mc?.roles?.includes('supporter') && !mc.roles.includes('attacker')) {
                reasons.push('サポーター先頭に通常/重撃コンボ');
            }
            if (reasons.length > 0) {
                push({
                    kind: 'bad-first-entry',
                    severity: 'warn',
                    characterId: entry.characterId,
                    characterName: charName,
                    archetypeIndex: 0,
                    archetypeName: a.name,
                    detail: `先頭 o[0] として不適切な可能性: ${reasons.join(' / ')}`,
                });
            }
        }

        // 2-4. 星4キャラへの不要な高凸制限チェック
        if (mc?.rarity === 4 && (a.constellation?.min ?? 0) >= 4) {
            push({
                kind: 'four-star-high-constellation',
                severity: 'warn',
                characterId: entry.characterId,
                characterName: charName,
                archetypeIndex: idx,
                archetypeName: a.name,
                detail: `星4キャラに constellation.min=${a.constellation?.min} が付いています（KQMの6凸偏りによる誤制限か要確認）`,
            });
        }

        // 2-5. 長大べた書きチェック
        const maxStintLen = Math.max(a.use.length, ...(a.then ?? []).map(t => t.use.length));
        if (maxStintLen >= 10) {
            push({
                kind: 'excessive-length',
                severity: 'warn',
                characterId: entry.characterId,
                characterName: charName,
                archetypeIndex: idx,
                archetypeName: a.name,
                detail: `1出場に ${maxStintLen} 手べた書きされています（fill への抽象化または削減を検討）`,
            });
        }

        // 2-6. 3回以上出場チェック
        if ((a.then?.length ?? 0) >= 2) {
            push({
                kind: 'excessive-stints',
                severity: 'warn',
                characterId: entry.characterId,
                characterName: charName,
                archetypeIndex: idx,
                archetypeName: a.name,
                detail: `1周に ${1 + (a.then?.length ?? 0)} 回出場する形です（不自然な細切れ出場の原因になりやすい）`,
            });
        }

        // 2-7. 未定義アクション参照チェック
        const allSteps = [
            ...a.use,
            ...(a.then ?? []).flatMap(t => t.use),
            ...(a.fill ?? []),
            ...(a.lead ?? []),
            ...(a.tail ?? []),
        ];
        for (const step of allSteps) {
            const base = step.split('@')[0];
            if (mc?.availableActions && !validActions.has(base)) {
                push({
                    kind: 'invalid-action',
                    severity: 'error',
                    characterId: entry.characterId,
                    characterName: charName,
                    archetypeIndex: idx,
                    archetypeName: a.name,
                    detail: `マスターに存在しないアクション「${step}」を参照しています`,
                });
            }
        }
    }
}

// 3. gcsim対応済みなのに辞書未登録のキャラ
for (const mc of master) {
    if (mc.source?.gcsimKey && !knowledgeIds.has(mc.id)) {
        push({
            kind: 'bloat-or-sparse',
            severity: 'warn',
            characterId: mc.id,
            characterName: mc.name,
            detail: 'gcsim 対応キャラですが KNOWLEDGE に未登録です',
        });
    }
}

// 集計
const byKind = new Map<IssueKind, AuditIssue[]>();
for (const it of issues) {
    const arr = byKind.get(it.kind) ?? [];
    arr.push(it);
    byKind.set(it.kind, arr);
}

const order: IssueKind[] = [
    'wrong-character',
    'inline-closing-bug-risk',
    'invalid-action',
    'duplicate-shape',
    'bad-first-entry',
    'four-star-high-constellation',
    'excessive-stints',
    'excessive-length',
    'bloat-or-sparse',
];

const lines: string[] = [
    '# Phase 0 知識辞書 品質監査レポート',
    '',
    `- 監査対象: KNOWLEDGE ${KNOWLEDGE.length} キャラ / マスター ${master.length} キャラ`,
    `- 検出合計: ${issues.length} 件（error: ${issues.filter(i => i.severity === 'error').length} 件 / warn: ${issues.filter(i => i.severity === 'warn').length} 件）`,
    '',
    '## 種別サマリー',
    '',
    '| 種別 | 件数 | 重大度 |',
    '| :--- | ---: | :--- |',
    ...order.map(k => {
        const arr = byKind.get(k) ?? [];
        const sev = arr.some(x => x.severity === 'error') ? 'error' : 'warn';
        return `| \`${k}\` | ${arr.length} | ${sev} |`;
    }),
    '',
];

for (const k of order) {
    const arr = byKind.get(k) ?? [];
    if (arr.length === 0) continue;
    lines.push(`## ${k}（${arr.length} 件）`, '');
    for (const it of arr) {
        const idxPart = it.archetypeIndex !== undefined ? ` [#${it.archetypeIndex}: ${it.archetypeName}]` : '';
        lines.push(`- **${it.characterName}** (\`${it.characterId}\`)${idxPart}: ${it.detail}`);
    }
    lines.push('');
}

const md = lines.join('\n');
if (outMd) {
    fs.mkdirSync(path.dirname(outMd), { recursive: true });
    fs.writeFileSync(outMd, md, 'utf8');
    console.log(`Markdown レポート出力: ${outMd}`);
} else {
    console.log(md);
}
if (outJson) {
    fs.mkdirSync(path.dirname(outJson), { recursive: true });
    fs.writeFileSync(outJson, JSON.stringify({ summary: Object.fromEntries(order.map(k => [k, (byKind.get(k) ?? []).length])), issues }, null, 2) + '\n', 'utf8');
    console.log(`JSON レポート出力: ${outJson}`);
}
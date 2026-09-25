/**
 * 命ノ星座（凸）で効果継続時間が延びるアクションを、「(n凸)」付きの別アクションとして追加する。
 *
 * genshin-db には凸適用後の数値データが無く、凸の説明文（例: 「旋火輪の継続時間+40%。」）しか無い。
 * そのため説明文から「○○の継続時間+X秒 / +X%」を読み取り、どのアクションの効果が延びるかを
 * 人が確認した一覧（VERIFIED_RULES）に載っているものだけ別アクションを生成する。
 *
 * 一覧に無い候補（新キャラ・説明文の変更など）はレポートの「未確認」に出るので、
 * 中身を確認して VERIFIED_RULES か NOT_APPLICABLE に追加する。
 */
import type { ActionDefinition, CharacterConfig } from '../types/genshin.ts';

export interface GenshinDbConstellation {
  name: string;
  c1?: { name: string; description: string };
  c2?: { name: string; description: string };
  c3?: { name: string; description: string };
  c4?: { name: string; description: string };
  c5?: { name: string; description: string };
  c6?: { name: string; description: string };
}

type ConstellationLevel = 1 | 2 | 3 | 4 | 5 | 6;

interface VerifiedRule {
  /** 延長対象のアクション（マスターのアクションID `${キャラID}_${target}`） */
  target: 'e' | 'e_hold' | 'q';
  /** 説明文の「○○の継続時間」の○○に含まれるべき語（説明文が変わったら生成せずエラーにする） */
  keyword: string;
}

/** 確認済み: 凸の延長対象が、マスターの効果継続時間（効果バー）と同じ効果のもの。キーは `${キャラID}_c${凸}` */
const VERIFIED_RULES: Record<string, VerifiedRule> = {
  xiangling_c4: { target: 'q', keyword: '旋火輪' },
  kukishinobu_c2: { target: 'e', keyword: '越祓草輪' },
  xingqiu_c2: { target: 'q', keyword: '裁雨留虹' },
  candace_c1: { target: 'q', keyword: '赤冠' },
  dahlia_c4: { target: 'q', keyword: '' }, // 「西風の恵み」効果（説明文の抽出部分は「効果」）
  emilie_c4: { target: 'q', keyword: 'アロマティック' },
  rosaria_c2: { target: 'q', keyword: '氷槍' },
  shenhe_c2: { target: 'q', keyword: '神女遣霊真訣' },
  sigewinne_c4: { target: 'q', keyword: '過飽和まごころお注射' },
  sucrose_c2: { target: 'q', keyword: '七五同構弐型' },
  yoimiya_c1: { target: 'q', keyword: '琉金の炎' },
};

/** 確認済み: 説明文は「継続時間+X」の形だが、別アクションにしないもの（理由つき） */
const NOT_APPLICABLE: Record<string, string> = {
  alhaitham_c6: '琢光鏡の残り時間の延長（条件付き）',
  collei_c2: '固有天賦「芽生え」状態の延長',
  dehya_c2: 'E 再発動時に再生成された領域のみ延長（条件付き）',
  dehya_c6: '会心発生ごとに +0.5秒（条件付き）',
  escoffier_c4: 'ヒーリング・ディッシュの延長（マスターの効果はチルドモード）',
  eula_c1: '冷酷な心の消費数に応じた物理ダメバフの延長（条件付き）',
  gorou_c2: '結晶の欠片獲得ごとに +1秒（条件付き）',
  iansan_c6: '運動量メーターの延長（マスターの Q 効果時間との対応が未確認）',
  lauma_c1: '「生を紡ぐ糸」効果の延長',
  mona_c1: '反応ダメージの強化（継続時間ではない）',
  nefer_c2: '固有天賦「偽りの帳」の延長',
  neuvillette_c6: '源水の雫の吸収ごとに +1秒（条件付き）',
  nilou_c1: '水環の延長（マスターの効果はピルエット）',
  noelle_c6: '敵を倒すごとに +1秒（条件付き）',
  thoma_c2: '元素爆発自体の継続時間の延長（マスターの効果はシールド継続時間）',
  vodyanitsa_c2: '「悠久の歌」効果の延長（マスターの効果との対応が未確認）',
  zhongli_c4: '石化効果の延長（マスターの効果はシールド）',
};

const DURATION_BONUS_PATTERN = /([^、。「」\s]+?)の?継続時間(?:が|を)?[+＋]\s*([\d.]+)\s*(%|秒)/;

export interface ConstellationVariantReport {
  /** 生成した凸アクション */
  added: Array<{ characterId: string; name: string; actionId: string; from: number; to: number }>;
  /** 説明文に延長の記述があるが、確認済み一覧に無いもの（要確認） */
  unreviewed: Array<{ characterId: string; name: string; constellation: number; description: string }>;
  /** 確認済み一覧にあるのに生成できなかったもの（説明文やマスターの変更） */
  errors: string[];
}

const LEVELS: ConstellationLevel[] = [1, 2, 3, 4, 5, 6];

/** 延長後の秒数（小数第2位まで） */
function extendDuration(base: number, amount: number, unit: string): number {
  const next = unit === '%' ? base * (1 + amount / 100) : base + amount;
  return Number(next.toFixed(2));
}

function buildVariant(base: ActionDefinition, level: ConstellationLevel, effectDuration: number, description: string): ActionDefinition {
  const tag = `(${level}凸)`;
  return {
    ...base,
    id: `${base.id}_c${level}`,
    name: `${base.name} ${tag}`,
    // 記法略称は元アクションと同じ（Q / E）。区別はアクション名・ボタン表示名の「(n凸)」で行う
    shortName: base.shortName,
    buttonLabel: `${base.buttonLabel ?? base.shortName} ${tag}`,
    effectDuration,
    description: `${level}凸: ${description}`,
  };
}

/**
 * キャラごとに、確認済みの凸延長を「(n凸)」付きの別アクションとして元アクションの直後に追加する
 */
export function applyConstellationVariants(
  characters: CharacterConfig[],
  constellations: GenshinDbConstellation[],
): ConstellationVariantReport {
  const report: ConstellationVariantReport = { added: [], unreviewed: [], errors: [] };
  const byName = new Map(constellations.map(c => [c.name, c]));

  for (const char of characters) {
    const con = byName.get(char.name);
    if (!con) continue;

    for (const level of LEVELS) {
      const text = (con[`c${level}`]?.description ?? '').replace(/\s+/g, ' ');
      const m = DURATION_BONUS_PATTERN.exec(text);
      if (!m) continue;
      const key = `${char.id}_c${level}`;
      const rule = VERIFIED_RULES[key];
      if (!rule) {
        if (!NOT_APPLICABLE[key]) {
          report.unreviewed.push({ characterId: char.id, name: char.name, constellation: level, description: text });
        }
        continue;
      }

      const [, subject, amountText, unit] = m;
      if (rule.keyword && !subject.includes(rule.keyword)) {
        report.errors.push(`${char.name} ${level}凸: 説明文の延長対象「${subject}」が確認時の「${rule.keyword}」と一致しません`);
        continue;
      }
      const baseIndex = char.availableActions.findIndex(a => a.id === `${char.id}_${rule.target}`);
      const base = char.availableActions[baseIndex];
      if (!base || !(base.effectDuration && base.effectDuration > 0)) {
        report.errors.push(`${char.name} ${level}凸: 延長元アクション ${char.id}_${rule.target} に効果継続時間がありません`);
        continue;
      }

      const to = extendDuration(base.effectDuration, Number(amountText), unit);
      const variant = buildVariant(base, level, to, text);
      char.availableActions.splice(baseIndex + 1, 0, variant);
      report.added.push({ characterId: char.id, name: char.name, actionId: variant.id, from: base.effectDuration, to });
    }
  }
  return report;
}

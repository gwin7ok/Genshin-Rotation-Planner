/**
 * 命ノ星座（凸）の段階データ（1〜6凸の名前・説明文と、アクションの値の変更）を作る。
 *
 * genshin-db には凸適用後の数値データが無く、凸の説明文（例: 「旋火輪の継続時間+40%。」）しか無い。
 * 数値として持つのは「効果継続時間の延長」だけで、説明文から「○○の継続時間+X秒 / +X%」を読み取り、
 * どのアクションの効果が延びるかを人が確認した一覧（VERIFIED_RULES）に載っているものだけ
 * 該当段階の actionChanges に入れる。凸数に応じた適用は CharacterModel が行う。
 *
 * 一覧に無い候補（新キャラ・説明文の変更など）はレポートの「未確認」に出るので、
 * 中身を確認して VERIFIED_RULES か NOT_APPLICABLE に追加する。
 */
import type { CharacterConfig, CharacterConstellationData, ConstellationLevel } from '../types/genshin.ts';

export interface GenshinDbConstellation {
  id: number;
  name: string;
  c1?: { name: string; description: string };
  c2?: { name: string; description: string };
  c3?: { name: string; description: string };
  c4?: { name: string; description: string };
  c5?: { name: string; description: string };
  c6?: { name: string; description: string };
}

interface VerifiedRule {
  /** 延長対象のアクション（マスターのアクションID `${キャラID}_${target}`） */
  target: 'e' | 'e_hold' | 'q';
  /** 説明文の「○○の継続時間」の○○に含まれるべき語（説明文が変わったら反映せずエラーにする） */
  keyword: string;
}

/** 確認済み: 凸の延長対象が、マスターの効果継続時間（効果バー）と同じ効果のもの。キーは `${キャラID}_c${凸}` */
const VERIFIED_RULES: Record<string, VerifiedRule | VerifiedRule[]> = {
  // 旅人(岩) 6凸: 1つの説明文に延長が2つ（岩潮幾重の岩の山 +5秒 = Q、星落としの剣の荒星 +10秒 = E）。gcsim traveler/common/geo の burst.go・skill.go の C6 と一致
  '10000005-geo_c6': [{ target: 'q', keyword: '岩の山' }, { target: 'e', keyword: '荒星' }],
  '10000007-geo_c6': [{ target: 'q', keyword: '岩の山' }, { target: 'e', keyword: '荒星' }],
  // フィッシュル 6凸: オズの存在時間 +2秒（元素スキルと元素爆発のオズ。gcsim の fischl は C6 で両方の存在時間を延ばす）
  '10000031-electro_c6': [{ target: 'e', keyword: 'オズ' }, { target: 'q', keyword: 'オズ' }],
  // 旅人(草) 2凸: 草蓮灯の存在時間 +3秒（元素爆発）
  '10000005-dendro_c2': { target: 'q', keyword: '草蓮灯' },
  '10000007-dendro_c2': { target: 'q', keyword: '草蓮灯' },
  '10000023-pyro_c4': { target: 'q', keyword: '旋火輪' }, // 香菱
  '10000065-electro_c2': { target: 'e', keyword: '越祓草輪' }, // 久岐忍
  '10000025-hydro_c2': { target: 'q', keyword: '裁雨留虹' }, // 行秋
  '10000072-hydro_c1': { target: 'q', keyword: '赤冠' }, // キャンディス
  '10000115-hydro_c4': { target: 'q', keyword: '' }, // ダリア:「西風の恵み」効果（説明文の抽出部分は「効果」）
  '10000099-dendro_c4': { target: 'q', keyword: 'アロマティック' }, // エミリエ
  '10000045-cryo_c2': { target: 'q', keyword: '氷槍' }, // ロサリア
  '10000063-cryo_c2': { target: 'q', keyword: '神女遣霊真訣' }, // 申鶴
  '10000095-hydro_c4': { target: 'q', keyword: '過飽和まごころお注射' }, // シグウィン
  '10000043-anemo_c2': { target: 'q', keyword: '七五同構弐型' }, // スクロース
  '10000049-pyro_c1': { target: 'q', keyword: '琉金の炎' }, // 宵宮
};

/** 確認済み: 説明文は「継続時間+X」の形だが、アクションの値の変更にしないもの（理由つき）。キーは `${キャラID}_c${凸}` */
const NOT_APPLICABLE: Record<string, string> = {
  '10000078-dendro_c6': '琢光鏡の残り時間の延長（条件付き）', // アルハイゼン
  '10000067-dendro_c2': '固有天賦「芽生え」状態の延長', // コレイ
  '10000079-pyro_c2': 'E 再発動時に再生成された領域のみ延長（条件付き）', // ディシア
  '10000079-pyro_c6': '会心発生ごとに +0.5秒（条件付き）', // ディシア
  '10000112-cryo_c4': 'ヒーリング・ディッシュの延長（マスターの効果はチルドモード）', // エスコフィエ
  '10000051-cryo_c1': '冷酷な心の消費数に応じた物理ダメバフの延長（条件付き）', // エウルア
  '10000055-geo_c2': '結晶の欠片獲得ごとに +1秒（条件付き）', // ゴロー
  '10000110-electro_c6': '運動量メーターの延長（マスターの Q 効果時間との対応が未確認）', // イアンサ
  '10000119-dendro_c1': '「生を紡ぐ糸」効果の延長', // ラウマ
  '10000041-hydro_c1': '反応ダメージの強化（継続時間ではない）', // モナ
  '10000122-dendro_c2': '固有天賦「偽りの帳」の延長', // ネフェル
  '10000087-hydro_c6': '源水の雫の吸収ごとに +1秒（条件付き）', // ヌヴィレット
  '10000070-hydro_c1': '水環の延長（マスターの効果はピルエット）', // ニィロウ
  '10000034-geo_c6': '敵を倒すごとに +1秒（条件付き）', // ノエル
  '10000050-pyro_c2': '元素爆発自体の継続時間の延長（マスターの効果はシールド継続時間）', // トーマ
  '10000140-hydro_c2': '「悠久の歌」効果の延長（マスターの効果との対応が未確認）', // ヴォジャニーツァ
  '10000030-geo_c4': '石化効果の延長（マスターの効果はシールド）', // 鍾離
  '10000076-anemo_c2': '赫耀多面体の存在時間の延長（マスターの効果は疾風示現）', // ファルザン
};

const DURATION_BONUS_PATTERN_ALL = /([^、。「」\s]+?)の?(?:継続|存在)時間(?:が|を)?[+＋]\s*([\d.]+)\s*(%|秒)/g;

export interface ConstellationReport {
  /** 凸の段階データを作ったキャラ数 */
  charactersWithConstellations: number;
  /** 反映した効果継続時間の延長 */
  added: Array<{ characterId: string; name: string; constellation: number; actionId: string; from: number; to: number }>;
  /** 説明文に延長の記述があるが、確認済み一覧に無いもの（要確認） */
  unreviewed: Array<{ characterId: string; name: string; constellation: number; description: string }>;
  /** 確認済み一覧にあるのに反映できなかったもの（説明文やマスターの変更） */
  errors: string[];
}

export const emptyConstellationReport = (): ConstellationReport => ({
  charactersWithConstellations: 0, added: [], unreviewed: [], errors: [],
});

const LEVELS: ConstellationLevel[] = [1, 2, 3, 4, 5, 6];

/** 延長後の秒数（小数第2位まで） */
function extendDuration(base: number, amount: number, unit: string): number {
  const next = unit === '%' ? base * (1 + amount / 100) : base + amount;
  return Number(next.toFixed(2));
}

/**
 * genshin-db の凸データから、キャラの段階データ（1〜6凸）を作る。
 * 確認済みの効果継続時間の延長は、該当段階の actionChanges に入れる
 */
export function buildConstellations(
  char: CharacterConfig,
  con: GenshinDbConstellation,
  report: ConstellationReport,
): CharacterConstellationData[] {
  const result: CharacterConstellationData[] = [];

  for (const level of LEVELS) {
    const entry = con[`c${level}`];
    if (!entry) continue;
    const text = (entry.description ?? '').replace(/\s+/g, ' ');
    const data: CharacterConstellationData = { level, name: entry.name, description: text };
    result.push(data);

    // 1つの説明文に延長が複数ある場合がある（旅人(岩) 6凸など）ので、すべて読み取る
    const matches = [...text.matchAll(DURATION_BONUS_PATTERN_ALL)];
    if (matches.length === 0) continue;
    const key = `${char.id}_c${level}`;
    const verified = VERIFIED_RULES[key];
    if (!verified) {
      if (!NOT_APPLICABLE[key]) {
        report.unreviewed.push({ characterId: char.id, name: char.name, constellation: level, description: text });
      }
      continue;
    }

    for (const rule of Array.isArray(verified) ? verified : [verified]) {
      // 確認済みの語を含む延長対象の記述を探す（語が空なら最初の記述）
      const m = matches.find(x => x[1].includes(rule.keyword));
      if (!m) {
        report.errors.push(`${char.name} ${level}凸: 説明文に、確認時の延長対象「${rule.keyword}」を含む記述がありません`);
        continue;
      }
      const [, , amountText, unit] = m;
      const actionId = `${char.id}_${rule.target}`;
      const base = char.availableActions.find(a => a.id === actionId);
      if (!base || !(base.effectDuration && base.effectDuration > 0)) {
        report.errors.push(`${char.name} ${level}凸: 延長元アクション ${actionId} に効果継続時間がありません`);
        continue;
      }

      const to = extendDuration(base.effectDuration, Number(amountText), unit);
      data.actionChanges = [...(data.actionChanges ?? []), { actionId, effectDuration: to, source: m[0] }];
      report.added.push({ characterId: char.id, name: char.name, constellation: level, actionId, from: base.effectDuration, to });
    }
  }

  if (result.length > 0) report.charactersWithConstellations++;
  return result;
}

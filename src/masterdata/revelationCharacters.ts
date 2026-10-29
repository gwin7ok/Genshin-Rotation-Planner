/**
 * 「諭示」を達成できるキャラ（八重神子。2026-10-05 / 七七を追加。2026-10-12）
 *
 * gcsim では、キャラの設定文のパラメータ `revelation`（`<キャラ> char ... +params=[revelation=0]`）で切り替える
 * （internal/characters/<キャラ>/<キャラ>.go: `p.Params["revelation"]`。**指定しないと有効（1）**）。
 * 対応するキャラ: gcsim のソースで `p.Params["revelation"]` を読んでいる 2 キャラ（v2.48.8 で確認。ほかのキャラの `Revelation` は技名）。
 *
 * 達成済みのときの違い（gcsim の実装）:
 *   - 八重神子: 殺生桜が爆発で壊れない／殺生桜の寿命が 10 秒長い（25 秒。未達成は 15 秒）／超電導・星電導の反応で、次の殺生桜の雷が強化される（ダメージのみ）
 *   - 七七: スキルの CT が 15 秒（未達成は 30 秒。`skill.go`: SetCD(30 秒) のあと ReduceActionCooldown(15 秒)）。
 *     ほかに、スキルの元素粒子・連携攻撃・反応ダメージの強化・固有天賦 2 の確率 100% / CT 15 秒（星電導の状態などの条件つき）があるが、
 *     時間の計算に入れるのはスキルの CT だけ（固有天賦 2 の短縮は、反応の状態に依存するため、アプリでは扱わない）
 */
import type { CharacterConfig } from '../types/genshin.ts';

/** 諭示に対応するキャラの gcsim のキー */
export const REVELATION_GCSIM_KEYS = new Set(['yaemiko', 'qiqi']);

/** 設定文のパラメータ名（gcsim: `+params=[revelation=0|1]`） */
export const REVELATION_GCSIM_PARAM = 'revelation';

/** 諭示に対応するキャラか（編成で「諭示達成」を設定できる） */
export const isRevelationCapable = (char: Pick<CharacterConfig, 'source'>): boolean =>
  char.source?.gcsimKey !== undefined && REVELATION_GCSIM_KEYS.has(char.source.gcsimKey);

/** 編成の設定で、諭示を達成済みか（対応するキャラで、未設定または有効。既定は有効 = gcsim の既定と同じ） */
export const isRevelation = (char: Pick<CharacterConfig, 'source' | 'revelation'>): boolean =>
  isRevelationCapable(char) && char.revelation !== false;

/**
 * 諭示を達成済みのときの、アクションの CT（秒。キー: gcsim のキャラのキー → アクション定義 ID）。
 * 凸の変更（actionChanges）の前の値を置き換える（CharacterModel.actions）。
 */
export const REVELATION_ACTION_COOLDOWNS: Record<string, Record<string, number>> = {
  qiqi: { '10000035-cryo_e': 15 },
};

/** 編成の「諭示達成」のチェックの説明（キャラごと） */
export const revelationTooltip = (gcsimKey: string | undefined, language: 'ja' | 'en' = 'ja'): string => {
  if (language === 'en') {
    const tailEn = ' (gcsim `revelation` parameter; default: achieved)';
    if (gcsimKey === 'qiqi') return `Revelation achieved. Skill CD becomes 30s → 15s. Particle generation, coordinated attacks and reaction DMG boosts are also enabled${tailEn}`;
    if (gcsimKey === 'yaemiko') return `Revelation achieved. Sesshou Sakura is no longer destroyed by the Burst and lasts 10s longer${tailEn}`;
    return 'Revelation achieved. Not implemented in gcsim, so it only affects the app-side buffs (placed manually)';
  }
  const base = '「諭示」を達成済み。';
  const tail = '（gcsim の `revelation` パラメータ。既定は達成済み）';
  if (gcsimKey === 'qiqi') return `${base}スキルの CT が 30 秒 → 15 秒になります。ほかに、元素粒子の発生・連携攻撃・反応ダメージの強化が有効になります${tail}`;
  if (gcsimKey === 'yaemiko') return `${base}殺生桜が爆発で壊れなくなり、寿命が 10 秒長くなります${tail}`;
  return `${base}gcsim には未実装のため、アプリ側の発動バフ（手で置く効果）にだけ反映されます`;
};

/** gcsim での実装の状況 */
export type RevelationGcsimStatus = 'implemented' | 'open-pr' | 'none';

/** 魔女の諭示（追加天賦）の強化内容と、gcsim・アプリでの扱い（表示用。2026-10-12 時点。出典: Wiki「魔女の諭示」、gcsim のソース・PR） */
export interface RevelationInfo {
  /** 追加天賦の名前 */
  talentName: string;
  /** 強化内容の要約（ダメージの強化を含む） */
  summary: string[];
  gcsim: { status: RevelationGcsimStatus; note: string };
  /** アプリでの扱い（時間・CT・効果に反映するもの / しないもの） */
  app: string;
  /** 英語の表示用の文（D255。追加天賦の名前は、公式の英語が見つからないので要確認） */
  en?: { talentName: string; summary: string[]; gcsimNote: string; app: string };
}

/** キー: gcsim のキャラのキー。ここにあるキャラが、魔女の諭示の対象（7 人） */
export const REVELATION_INFO: Record<string, RevelationInfo> = {
  qiqi: {
    talentName: '七宝奉真',
    summary: [
      '仙法·寒病鬼差（スキル）のクールタイムが 15 秒に短縮される。',
      '輝映: 寒病鬼差の間、反応ダメージが +50%（超電導・星電導、氷拡散・星拡散）。極星フィールド内で輝映・星電導、星拡散の後 8 秒間は輝映・星拡散になる。',
      '固有天賦2 の度厄のお札は、輝映のとき確率 100%・クールタイム 15 秒。凸1・2・4・6 も強化される。',
    ],
    gcsim: { status: 'implemented', note: 'revelation パラメータ（既定は達成済み）。マージ済み（PR #3046）' },
    app: 'スキルの CT 15 秒を、時間の計算に反映。固有天賦2 の短縮は、輝映の状態に依存するため、反映しない。',
    en: {
      talentName: "Seven Treasures of Truth",
      summary: [
        "Adeptus Art: Herald of Frost (Skill) CD is reduced to 15s.",
        "Moonsign-style boost: during Herald of Frost, reaction DMG +50% (Superconduct / Stellar Conduct, Cryo Swirl / Stellar Swirl). Inside the field, it becomes the enhanced variant for 8s after the reaction.",
        "A2 talisman becomes 100% chance with a 15s CD while boosted. C1, C2, C4 and C6 are also enhanced.",
      ],
      gcsimNote: "revelation parameter (default: achieved). Merged (PR #3046)",
      app: "The 15s Skill CD is applied to timing. The A2 reduction depends on the boosted state and is not applied.",
    },
  },
  yaemiko: {
    talentName: '大祓之宣託',
    summary: [
      '殺生桜の継続時間が 10 秒延びる。爆発で桜が壊れず、桜に憑依して落雷になる。',
      '超電導・星電導の後、次の落雷が攻撃力の 80% 強化される（2.5 秒に 1 回）。',
      '輝映・星電導: 強化された落雷の後に追加の雷ダメージ。凸1・2・4・6 も強化される。',
    ],
    gcsim: { status: 'implemented', note: 'revelation パラメータ（既定は達成済み）。マージ済み（PR #2775）' },
    app: '殺生桜の寿命 +10 秒と、爆発で桜が壊れない動きを、時間の計算に反映済み。',
    en: {
      talentName: "Grand Purification Oracle",
      summary: [
        "Sesshou Sakura duration +10s. Bursts no longer destroy the Sakura; it possesses the Sakura and strikes as lightning.",
        "After Superconduct / Stellar Conduct, the next strike is enhanced by 80% of ATK (once every 2.5s).",
        "Boosted Stellar Conduct: extra Electro DMG after the enhanced strike. C1, C2, C4 and C6 are also enhanced.",
      ],
      gcsimNote: "revelation parameter (default: achieved). Merged (PR #2775)",
      app: "Sakura lifetime +10s and Sakura surviving the Burst are applied to timing.",
    },
  },
  wriothesley: {
    talentName: 'やがて冤罪は暴かれる',
    summary: [
      '輝映・星電導のとき、HP60% 未満で、重撃が天輝・ヴォールティングアッパー（スタミナ消費なし・HP30% 回復・2 秒に 1 回）に強化される。',
      '烈霜の懲戒の第 3 段・第 5 段と天輝・ヴォールティングアッパーが星電導ダメージになり、星電導ダメージ +30%。',
      '凸1: 天輝・ヴォールティングアッパーが命中したとき、烈霜の懲戒が 4 秒延びる（1 回のみ）。凸2・4・6 も強化される。',
    ],
    gcsim: { status: 'open-pr', note: 'gcsim に未マージの PR #3212（Add Wrio Revelation。revelation パラメータ。既定は達成済み）' },
    app: '未反映（gcsim の実装を待つ。マージされたら、対応キャラに追加して反映）。',
    en: {
      talentName: "Injustice Will Be Revealed",
      summary: [
        "While boosted with Stellar Conduct and below 60% HP, Charged Attacks become an enhanced Vaulting Fist (no Stamina, heals 30% HP, once every 2s).",
        "The 3rd and 5th hits of Icicle Punishment and the enhanced Vaulting Fist deal Stellar Conduct DMG; Stellar Conduct DMG +30%.",
        "C1: when the enhanced Vaulting Fist hits, Icicle Punishment is extended by 4s (once). C2, C4 and C6 are also enhanced.",
      ],
      gcsimNote: "Unmerged gcsim PR #3212 (Add Wrio Revelation; revelation parameter, default: achieved)",
      app: "Not applied (waiting for gcsim; will be added once merged).",
    },
  },
  yumemizukimizuki: {
    talentName: '廓然夢生',
    summary: [
      '夢浮かみの状態で拡散・星拡散を起こすと、次の周期ダメージが元素熟知の 1000% 強化される（2.5 秒に 1 回）。',
      '輝映・星拡散: 追加ダメージが出て、チームの元素熟知が自身の 10% 分上がる（星拡散の後 8 秒間）。',
      '凸1・2（炎・水・氷・雷・風の耐性 -20%）・4（追加の回復）・6 も強化される。',
    ],
    gcsim: { status: 'open-pr', note: 'gcsim に未マージの PR #3208（Add Mizuki Revelation。revelation パラメータ。既定は達成済み）。凸6 の星拡散の会心は、すでに常時有効' },
    app: '未反映（gcsim の実装を待つ）。',
    en: {
      talentName: "Expansive Dream",
      summary: [
        "Triggering Swirl / Stellar Swirl in the Dreamdrifter state enhances the next periodic DMG by 1000% of EM (once every 2.5s).",
        "Boosted Stellar Swirl: extra DMG, and party EM increases by 10% of hers (for 8s after Stellar Swirl).",
        "C1, C2 (Pyro/Hydro/Cryo/Electro/Anemo RES -20%), C4 (extra healing) and C6 are also enhanced.",
      ],
      gcsimNote: "Unmerged gcsim PR #3208 (Add Mizuki Revelation; revelation parameter, default: achieved). C6 Stellar Swirl CRIT is already always active",
      app: "Not applied (waiting for gcsim).",
    },
  },
  diona: {
    talentName: '選りすぐりの宝物',
    summary: [
      'スキルを発動してから 20 秒間、チームが星電導・超電導・氷拡散・星拡散を起こすと、連携でフリーズキャッツクローを 3 つ発射する（3.5 秒に 1 回。元素粒子・シールドなし）。',
      '極星フィールド内・星拡散の後 8 秒間は、それぞれ輝映・星電導 / 輝映・星拡散になる。',
      '凸6: HP 上限 +25%。輝映のとき、特製スピリッツの範囲内のキャラの反応ダメージが +40%。',
    ],
    gcsim: { status: 'none', note: 'gcsim に実装なし（PR なし）' },
    app: '「連携フリーズキャッツクローの受付 20 秒」を、発動バフ（手で置く効果）として出す。ダメージは計算しない。',
    en: {
      talentName: "Choice Treasures",
      summary: [
        "For 20s after using her Skill, when the party triggers Stellar Conduct, Superconduct, Cryo Swirl or Stellar Swirl, she fires 3 coordinated Icy Paws (once every 3.5s; no particles or shield).",
        "Inside the field and for 8s after Stellar Swirl, these become the boosted variants.",
        "C6: Max HP +25%. While boosted, characters inside Signature Mix gain reaction DMG +40%.",
      ],
      gcsimNote: "Not implemented in gcsim (no PR)",
      app: "Shown as a manually placed buff: \"coordinated Icy Paws window, 20s\". DMG is not calculated.",
    },
  },
  beidou: {
    talentName: '星の導き',
    summary: [
      '長押しで浪追いを発動すると、攻撃を受けなくても 0.8 秒ごとに自動で力が溜まる。',
      '発動時の力 1 ごとに、スキルのクールタイムが 4 秒短縮され、元素エネルギーを 8 回復する（15 秒に 1 回）。',
      '凸6: 雷斫りの間、輝映のとき、敵の氷耐性 -15%・フィールド上のキャラの元素熟知 +200。',
    ],
    gcsim: { status: 'none', note: 'gcsim に実装なし（PR なし）' },
    app: '未反映（CT 短縮は、長押しの溜め方で変わるため、仕様が確認できるまで保留）。',
    en: {
      talentName: "Guiding Star",
      summary: [
        "When Tidecaller is held, it charges automatically every 0.8s even without being hit.",
        "Each charge stack on release reduces the Skill CD by 4s and restores 8 Energy (once every 15s).",
        "C6: during Stormbreaker, while boosted, enemy Cryo RES -15% and active character EM +200.",
      ],
      gcsimNote: "Not implemented in gcsim (no PR)",
      app: "Not applied (the CD reduction depends on how the hold is charged; on hold until confirmed).",
    },
  },
  cyno: {
    talentName: '旅立ちの伴星',
    summary: [
      '追加天賦のほか、秘儀・律淵渡魂（スキル）・固有天賦2つ・凸1・2・4・6 が強化される。',
      '強化の内容は、Wiki でも情報が揃っていない（■ の表示）。',
    ],
    gcsim: { status: 'none', note: 'gcsim に実装なし（PR なし）。コードにあるのは、凸4 の対象反応に星電導が入っているだけ' },
    app: '未反映（情報が揃うまで保留）。',
    en: {
      talentName: "Companion Star",
      summary: [
        "Besides the extra talent, Secret Rite: Chasmic Soulfarer (Skill), both passive talents, and C1, C2, C4 and C6 are enhanced.",
        "Details are incomplete even on the wiki.",
      ],
      gcsimNote: "Not implemented in gcsim (no PR). The code only includes Stellar Conduct in the C4 reaction list",
      app: "Not applied (on hold until details are available).",
    },
  },
};

/** 魔女の諭示の対象のキャラか（強化内容を表示する） */
export const hasRevelationInfo = (char: Pick<CharacterConfig, 'source'>): boolean =>
  char.source?.gcsimKey !== undefined && char.source.gcsimKey in REVELATION_INFO;

/**
 * gcsim に実装が無いキャラの、諭示のアプリ側の発動バフ（手で置く効果。時間の分かるものだけ）。
 * 編成で「諭示達成」が有効のときだけ、候補に出す。gcsim が実装したら、この表の行を消す
 */
export const APP_SIDE_REVELATION_BUFFS: Record<string, { idSuffix: string; name: string; duration: number; description: string; en?: { name: string; description: string } }[]> = {
  diona: [
    {
      idSuffix: 'revelation_claws',
      name: '諭示: 連携フリーズキャッツクローの受付',
      duration: 20,
      description: 'スキルを発動してから 20 秒間、チームが星電導・超電導・氷拡散・星拡散を起こすと、連携でフリーズキャッツクローを 3 つ発射する（3.5 秒に 1 回）。スキルの発動に合わせて置く。ダメージは計算しない',
      en: {
        name: 'Revelation: coordinated Icy Paws window',
        description: 'For 20s after using her Skill, when the party triggers Stellar Conduct, Superconduct, Cryo Swirl or Stellar Swirl, she fires 3 coordinated Icy Paws (once every 3.5s). Place it with the Skill. DMG is not calculated',
      },
    },
  ],
};

/** 編成で「諭示達成」を設定できるか（gcsim に実装がある、またはアプリ側の効果がある） */
export const hasRevelationSetting = (char: Pick<CharacterConfig, 'source'>): boolean =>
  isRevelationCapable(char) || (char.source?.gcsimKey !== undefined && char.source.gcsimKey in APP_SIDE_REVELATION_BUFFS);

/** 諭示達成が有効か（アプリ側の効果用。設定できるキャラで、未設定または有効） */
export const isRevelationAppSide = (char: Pick<CharacterConfig, 'source' | 'revelation'>): boolean =>
  hasRevelationSetting(char) && char.revelation !== false;

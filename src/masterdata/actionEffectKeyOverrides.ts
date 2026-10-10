import type { EffectKeyOverride } from './actionGcsimLink.ts';

/**
 * スキル・爆発の効果に対応する gcsim のキー: 手で補う一覧（public/data/action_effect_keys.json の自動収集結果を上書きする）
 *
 * 自動収集（scripts/probe-effect-keys.ts）は、アクション定義 ID ごとに、そのキャラの skill / burst 分類の効果のうち、
 * 「その命令の発動から 6 秒以内にイベントが起き、すべてのイベントが同キャラのスキル・爆発の発動から 6 秒以内に起き、
 * 1回の発動あたり 4 イベント以下」のキーを選ぶ。候補が複数あるときは、マスターの効果時間（genshin-db 由来）に最も近いキーを primary にする。
 * さらに scripts/link-effect-by-duration.ts が、キーが見つからなかった定義を、マスターの効果時間に一致する継続時間のイベント
 * （状態・設置物・シールド・継続ダメージ）に紐づける。それでも足りないものだけ、ここで指定する。
 *
 * キー: アクション定義 ID（例: `10000096-pyro_e`）。値:
 *   - '' … その定義は書き戻さない（アプリの値のまま）
 *   - 'キー' … 使う gcsim のキー（状態のキー / `construct:<名前>` / `shield:<名前>` / `damage:<ダメージの名前>`）
 *   - { key, mode, self } … 継続時間の求め方（expiry = 終了予定 / ended = 実際の終了 / span = 更新が続く間）と、実行したキャラ自身のイベントだけを使うか
 */
export const ACTION_EFFECT_KEY_OVERRIDES: Record<string, EffectKeyOverride> = {
  // 重雲のスキル: 領域の gcsim の状態（chongyunfield = 10 秒）は、氷付与の長さ + 領域の継続時間を表す効果バーとは別なので、書き戻さない（アプリの fieldEffect で計算。2026-10-10）
  '10000036-cryo_e': '',
  // オデットの特殊元素スキル（スキルの後の約 6.6 秒だけ使える。別のアクション。2026-10-01）: 完了時に付く独舞者の強化 20 秒
  '10000150-cryo_e_recast': 'odette-dance-double-upgrade',
  // --- 継続時間の一致では紐づかなかったが、ユーザーがゲーム内の説明（wiki）で確認して指定したもの（2026-09-30）---
  // 鍾離のスキル（短押し）: 岩柱の継続時間 30 秒（gcsim は 31 秒）。長押しのシールドとは別
  '10000030-geo_e': 'construct:ZhongliSkill',
  // 凝光のスキル: 璇璣屏の継続時間 30 秒
  '10000027-geo_e': 'construct:NingSkill',
  // ディオナのスキル: キャッツクロー 1 枚のシールド継続時間（マスターの 1.8 秒は 1 枚あたり）。短押し 2 枚 = 4.8 秒、長押し 5 枚 = 12 秒
  '10000039-cryo_e': 'shield:Icy Paws (Shield)',
  '10000039-cryo_e_hold': 'shield:Icy Paws (Shield)',
  // 白朮の爆発: シールドは断続的に作られるが、14 秒の効果として表示する
  '10000082-dendro_q': 'shield:Baizhu Seamless shield',
  // タルタリヤの爆発: 断流（敵に付く状態）18 秒
  '10000033-hydro_q': 'riptide',
  // 夜魂の状態: 継続時間は gcsim が夜魂値から計算した実際の終了（ended）。全員が同じキーを使うので自分のものだけ
  '10000113-anemo_e': { key: 'nightsoul-blessing', mode: 'ended', self: true }, // イファのスキル
  '10000104-anemo_e': { key: 'nightsoul-blessing', mode: 'ended', self: true }, // チャスカのスキル
  '10000106-pyro_e': { key: 'nightsoul-blessing', mode: 'ended', self: true }, // マーヴィカのスキル
  '10000106-pyro_e_hold': { key: 'nightsoul-blessing', mode: 'ended', self: true }, // マーヴィカのスキル（長押し）
  // 夜魂の状態を持つ他のキャラ（マスターの効果時間が無いが、gcsim の値で登録。2026-09-30 ユーザー指示）
  '10000005-pyro_e': { key: 'nightsoul-blessing', mode: 'ended', self: true }, // 空(炎)のスキル
  '10000007-pyro_e': { key: 'nightsoul-blessing', mode: 'ended', self: true }, // 蛍(炎)のスキル
  '10000101-dendro_e': { key: 'nightsoul-blessing', mode: 'ended', self: true }, // キィニチのスキル
  '10000111-electro_q': { key: 'nightsoul-blessing', mode: 'ended', self: true }, // ヴァレサの爆発
  // 藍硯のスキル: 自動収集は、跳び退きの短い状態 leap-back（1.1 秒）を選んでいた。効果本体は燕の羽ばたき（シールド 12.5 秒。マスターの 12.5 秒と一致）
  '10000108-anemo_e': 'shield:Swallow-Wisp Pinion Dance (Shield)',
  // 藍硯の長押し: 自動収集は leap-back（1.1 秒）を選ぶが、長押しでも同じ燕の羽ばたき（シールド 12.5 秒。gcsim で hold=1・60 とも 750f を確認 2026-10-09）
  '10000108-anemo_e_hold': 'shield:Swallow-Wisp Pinion Dance (Shield)',
  // 書き戻さない（自動収集の誤りの打ち消し、またはユーザー決定）:
  // ファルカの特殊スキル: 自動収集が選んだ sturm-und-drang は、スキル本体の状態。特殊スキルのバーは出さない（effectKeyDecisions の決定どおり）
  '10000128-anemo_e_specialskill': '',
  // チャスカの爆発: 自動収集が選んだ chasca-plunge-available は 0.43 秒の落下攻撃の窓で、爆発の効果ではない
  '10000104-anemo_q': '',
  // スカークの長押し: 登録しない（ユーザー決定）。自動収集が選んだ skirk-hold-e-anim は 0 秒
  '10000114-cryo_e_hold': '',
  // デュリンの爆発: 白の姿のあとは durin-burst-white、黒の姿のあとは durin-burst-black（どちらも 20.5 秒）が出る
  '10000123-pyro_q': { key: 'durin-burst-white', alt: ['durin-burst-black'] },
  // 継続ダメージのまとまりを、効果時間（本体）として登録（ユーザー決定 2026-09-30。マスターの値は gcsim の値で上書き）
  // モナのスキル: 虚影（幻影）のダメージが続く間
  '10000041-hydro_e': 'damage:Mirror Reflection of Doom (Tick)',
  // モナの長押し（水中の幻願。一回押しと同じ鏡のダメージ）・ラウマの長押し（霜林の聖域。一回押しと同じ）
  '10000041-hydro_e_hold': 'damage:Mirror Reflection of Doom (Tick)',
  // シグウィンの長押し 2 段（一回押しと同じ状態 sigewinne-skill）
  '10000095-hydro_e_shorthold': 'sigewinne-skill',
  '10000095-hydro_e_hold': 'sigewinne-skill',
  '10000119-dendro_e_hold': 'lauma-frostgrove-sanctuary',
  // 早柚の爆発: むじむじダルマ（マスター 12 秒。gcsim は約 9 秒）
  '10000053-anemo_q': 'damage:Muji-Muji Daruma',
  // シャルロットの爆発: 撮影（マスター 4 秒。gcsim は約 3 秒）
  '10000088-cryo_q': 'damage:Still Photo: Kamera',
  // 八重神子のスキル: 殺生桜のバーはアプリ側の数え方で出す（D81）ので、gcsim の効果（継続ダメージ・最古の桜の期限）は書き戻さない
  '10000058-electro_e': '',
};

/**
 * キャラの役割の初期値（ローテーションの自動探索で、アタッカーなどを見分けるのに使う。D-フェーズ9）。
 * 1 キャラに複数の役割がつく（例: アタッカー ＋ サポーター = 「両対応」）。キーはキャラ ID（名前ではなく ID。右のコメントは名前）。
 * 元の表と判断の根拠: docs/gcsim-integration/phase-9-auto-rotation-search/役割の下書き.md
 *
 * 役割の定義:
 *  - attacker（アタッカー）: 表で攻撃アクション（通常攻撃や重撃）を起こすことでダメージを出す役。サブアタッカーの連係攻撃を発動するドライバー役も含む
 *  - subAttacker（サブアタッカー）: 設置物や、表のキャラの通常攻撃などに連動する連係攻撃などで、裏からダメージを出す役
 *  - supporter（サポーター）: ヒーラー・シールダー・裏からの元素付着役
 *
 * マスター生成（characterMasterGenerator.ts）が、この表をキャラの `roles` に入れる。表を直したら、`npm run build:master` を実行し、DB バージョンを上げる。
 */
import type { CharacterRole } from '../types/genshin.ts';

export const CHARACTER_ROLES: Record<string, CharacterRole[]> = {
  '10000002-cryo': ['attacker'], // 神里綾華
  '10000003-anemo': ['supporter'], // ジン
  '10000005-anemo': ['supporter'], // 空(風)
  '10000005-cryo': ['attacker'], // 空(氷)
  '10000005-dendro': ['subAttacker', 'supporter'], // 空(草)
  '10000005-electro': ['supporter'], // 空(雷)
  '10000005-geo': ['supporter'], // 空(岩)
  '10000005-hydro': ['supporter'], // 空(水)
  '10000005-pyro': ['subAttacker'], // 空(炎)
  '10000006-electro': ['subAttacker'], // リサ
  '10000007-anemo': ['supporter'], // 蛍(風)
  '10000007-cryo': ['attacker'], // 蛍(氷)
  '10000007-dendro': ['subAttacker', 'supporter'], // 蛍(草)
  '10000007-electro': ['supporter'], // 蛍(雷)
  '10000007-geo': ['supporter'], // 蛍(岩)
  '10000007-hydro': ['supporter'], // 蛍(水)
  '10000007-pyro': ['subAttacker'], // 蛍(炎)
  '10000014-hydro': ['supporter'], // バーバラ
  '10000015-cryo': ['subAttacker'], // ガイア
  '10000016-pyro': ['attacker'], // ディルック
  '10000020-electro': ['attacker'], // レザー
  '10000021-pyro': ['subAttacker'], // アンバー
  '10000022-anemo': ['attacker', 'supporter'], // ウェンティ
  '10000023-pyro': ['subAttacker'], // 香菱
  '10000024-electro': ['supporter'], // 北斗
  '10000025-hydro': ['supporter'], // 行秋
  '10000026-anemo': ['attacker'], // 魈
  '10000027-geo': ['attacker'], // 凝光
  '10000029-pyro': ['attacker'], // クレー
  '10000030-geo': ['supporter'], // 鍾離
  '10000031-electro': ['subAttacker'], // フィッシュル
  '10000032-pyro': ['supporter'], // ベネット
  '10000033-hydro': ['attacker'], // タルタリヤ
  '10000034-geo': ['attacker'], // ノエル
  '10000035-cryo': ['supporter'], // 七七
  '10000036-cryo': ['attacker', 'supporter'], // 重雲
  '10000037-cryo': ['attacker'], // 甘雨
  '10000038-geo': ['subAttacker'], // アルベド
  '10000039-cryo': ['supporter'], // ディオナ
  '10000041-hydro': ['attacker', 'supporter'], // モナ
  '10000042-electro': ['attacker'], // 刻晴
  '10000043-anemo': ['attacker', 'supporter'], // スクロース
  '10000044-pyro': ['attacker', 'supporter'], // 辛炎
  '10000045-cryo': ['subAttacker'], // ロサリア
  '10000046-pyro': ['attacker'], // 胡桃
  '10000047-anemo': ['supporter'], // 楓原万葉
  '10000048-pyro': ['attacker'], // 煙緋
  '10000049-pyro': ['attacker'], // 宵宮
  '10000050-pyro': ['supporter'], // トーマ
  '10000051-cryo': ['attacker'], // エウルア
  '10000052-electro': ['attacker', 'supporter'], // 雷電将軍
  '10000053-anemo': ['supporter'], // 早柚
  '10000054-hydro': ['attacker', 'supporter'], // 珊瑚宮心海
  '10000055-geo': ['supporter'], // ゴロー
  '10000056-electro': ['supporter'], // 九条裟羅
  '10000057-geo': ['attacker'], // 荒瀧一斗
  '10000058-electro': ['subAttacker'], // 八重神子
  '10000059-anemo': ['attacker'], // 鹿野院平蔵
  '10000060-hydro': ['supporter'], // 夜蘭
  '10000061-dendro': ['subAttacker', 'supporter'], // 綺良々
  '10000062-cryo': ['attacker'], // アーロイ
  '10000063-cryo': ['supporter'], // 申鶴
  '10000064-geo': ['supporter'], // 雲菫
  '10000065-electro': ['supporter'], // 久岐忍
  '10000066-hydro': ['attacker'], // 神里綾人
  '10000067-dendro': ['subAttacker'], // コレイ
  '10000068-electro': ['supporter'], // ドリー
  '10000069-dendro': ['attacker'], // ティナリ
  '10000070-hydro': ['attacker', 'supporter'], // ニィロウ
  '10000071-electro': ['attacker'], // セノ
  '10000072-hydro': ['supporter'], // キャンディス
  '10000073-dendro': ['attacker', 'supporter'], // ナヒーダ
  '10000074-cryo': ['supporter'], // レイラ
  '10000075-anemo': ['attacker'], // 放浪者
  '10000076-anemo': ['supporter'], // ファルザン
  '10000077-dendro': ['supporter'], // ヨォーヨ
  '10000078-dendro': ['attacker'], // アルハイゼン
  '10000079-pyro': ['supporter'], // ディシア
  '10000080-cryo': ['supporter'], // ミカ
  '10000081-dendro': ['attacker'], // カーヴェ
  '10000082-dendro': ['supporter'], // 白朮
  '10000083-anemo': ['subAttacker'], // リネット
  '10000084-pyro': ['attacker'], // リネ
  '10000085-cryo': ['attacker'], // フレミネ
  '10000086-cryo': ['attacker'], // リオセスリ
  '10000087-hydro': ['attacker'], // ヌヴィレット
  '10000088-cryo': ['supporter'], // シャルロット
  '10000089-hydro': ['supporter'], // フリーナ
  '10000090-pyro': ['supporter'], // シュヴルーズ
  '10000091-geo': ['attacker'], // ナヴィア
  '10000092-pyro': ['attacker'], // 嘉明
  '10000093-anemo': ['supporter'], // 閑雲
  '10000094-geo': ['subAttacker'], // 千織
  '10000095-hydro': ['supporter'], // シグウィン
  '10000096-pyro': ['attacker'], // アルレッキーノ
  '10000097-electro': ['attacker'], // セトス
  '10000098-electro': ['attacker'], // クロリンデ
  '10000099-dendro': ['subAttacker'], // エミリエ
  '10000100-geo': ['attacker', 'supporter'], // カチーナ
  '10000101-dendro': ['attacker'], // キィニチ
  '10000102-hydro': ['attacker'], // ムアラニ
  '10000103-geo': ['supporter'], // シロネン
  '10000104-anemo': ['attacker'], // チャスカ
  '10000105-electro': ['subAttacker'], // オロルン
  '10000106-pyro': ['attacker'], // マーヴィカ
  '10000107-cryo': ['subAttacker', 'supporter'], // シトラリ
  '10000108-anemo': ['supporter'], // 藍硯
  '10000109-anemo': ['attacker'], // 夢見月瑞希
  '10000110-electro': ['supporter'], // イアンサ
  '10000111-electro': ['attacker'], // ヴァレサ
  '10000112-cryo': ['supporter'], // エスコフィエ
  '10000113-anemo': ['attacker'], // イファ
  '10000114-cryo': ['attacker'], // スカーク
  '10000115-hydro': ['supporter'], // ダリア
  '10000116-electro': ['subAttacker', 'supporter'], // イネファ
  '10000119-dendro': ['subAttacker'], // ラウマ
  '10000120-electro': ['attacker'], // フリンズ
  '10000121-hydro': ['supporter'], // アイノ
  '10000122-dendro': ['attacker'], // ネフェル
  '10000123-pyro': ['subAttacker'], // ドゥリン
  '10000124-anemo': ['supporter'], // ヤフォダ
  '10000125-hydro': ['attacker', 'subAttacker'], // コロンビーナ
  '10000126-geo': ['attacker'], // 兹白
  '10000127-geo': ['supporter'], // イルーガ
  '10000128-anemo': ['attacker'], // ファルカ
  '10000129-cryo': ['attacker'], // ローエン
  '10000130-geo': ['subAttacker', 'supporter'], // リンネア
  '10000131-pyro': ['supporter'], // ニコ
  '10000132-anemo': ['supporter'], // プルーネ
  '10000133-cryo': ['attacker'], // サンドローネ
  '10000136-electro': ['attacker', 'subAttacker'], // ミティヤ
  '10000137-electro': ['supporter'], // バレリー
  '10000140-hydro': ['supporter'], // ヴォジャニーツァ
  '10000143-anemo': ['attacker'], // ヴェスナ
  '10000148-electro': ['supporter'], // アリョーシャ
  '10000150-cryo': ['subAttacker'], // オデット
};

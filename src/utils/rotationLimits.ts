/**
 * 外から読み込む編成（?import= のリンク・JSON ファイル・バックアップ・保存編成・自動保存）の、値の上限と、gcsim の命令の形。
 *
 * 目的（2026-11-18 のセキュリティ確認）:
 *   - 極端に大きい数値・件数（所要時間 1e7 秒、出場 20,000 件など）で、画面が固まる。しかも自動保存に残り、開くたびに固まる
 *   - action.gcsimCommand（自由な文字列）が、gcsim の設定文にそのまま入り、改行・`;`・ループなどの命令を差し込める
 * 上限は、正しい編成が、まず届かない大きさ（実データの最大の何十倍）にしている。検査は rotationValidation.ts が使う。
 */

/** 時間（秒）の 1 つの値の絶対値の上限。実データの最大は 900（命ノ星座の CT）。ほとんどのアクションは 1 分以内 */
export const MAX_TIME_SECONDS = 3600;
/** 交代の遅れ（秒）。画面の選択肢は 0〜1 秒 */
export const MAX_SWITCH_DELAY = 60;
/** 保存された総時間（秒）。実際の総時間は、アクションから計算される */
export const MAX_TOTAL_DURATION = 100000;
/** 時間以外の数値（凸数・精錬・エネルギーチャージ効率・天賦など）の絶対値の上限 */
export const MAX_NUMBER = 1_000_000;

/** 編成の枠の数（正しい編成は 4 人） */
export const MAX_PARTY = 8;
/** 出場の数 */
export const MAX_STINTS = 200;
/** グループの繰り返しを展開した後の、アクションの合計の数（正しい編成は、多くても数十） */
export const MAX_EXPANDED_ACTIONS = 2000;
/** 1 つの出場の、グループ・発動バフ・副次効果の数 */
export const MAX_LIST_ITEMS = 500;
/** グループの複製ごとの所要時間・聖遺物ステータスなど、キーを持つ入れ物の項目数 */
export const MAX_MAP_ENTRIES = 100;
/** 反応の行の数・1 行の区間の数 */
export const MAX_REACTION_ROWS = 200;
export const MAX_REACTION_SEGMENTS = 1000;

/** ID・キーの文字数 */
export const MAX_ID_LENGTH = 200;
/** 編成名・アクション名などの短い文字列の文字数 */
export const MAX_NAME_LENGTH = 200;
/** メモ・説明などの長い文字列の文字数 */
export const MAX_TEXT_LENGTH = 10000;

/** ガントチャートの目盛り（1 秒ごと）の最大数。これを超える長さ（150 秒超。通常の編成は 1 分以内）のときは、間引く（描画の部品の数を抑える） */
export const MAX_TIMELINE_TICKS = 150;

/**
 * gcsim の設定文に入れてよい命令の形: 名前（小文字・数字・_）+ 任意の `:数字` + 任意の `[キー=値,…]`（例: `skill`・`attack:3`・`skill[recast=1]`）。
 * 改行・`;`・空白・`{ }`・`(` などは入らないので、別の命令・ループ・式を差し込めない
 */
const GCSIM_COMMAND_PATTERN = /^[a-z][a-z0-9_]{0,39}(?::\d{1,3})?(?:\[[a-z0-9_]{1,40}=[\w.+-]{1,20}(?:,[a-z0-9_]{1,40}=[\w.+-]{1,20}){0,7}\])?$/;

export const isSafeGcsimCommand = (v: unknown): v is string => typeof v === 'string' && GCSIM_COMMAND_PATTERN.test(v);

/**
 * gcsim のキー（キャラ・武器・聖遺物の `gcsimKey`）の形: 小文字で始まる、小文字・数字・_ だけ（例: `keqing`・`skywardblade`・`gildeddreams`。同梱のマスターの全件が、この形）。
 * キーは、設定文に、そのまま（キャラ）または `"…"` の中（武器・聖遺物）に入る。引用符・`;`・改行を含むキーで、別の命令を差し込めないようにする。
 * DB 管理の JSON 取り込み・バックアップの復元で、外から入ってくる
 */
const GCSIM_KEY_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

export const isSafeGcsimKey = (v: unknown): v is string => typeof v === 'string' && GCSIM_KEY_PATTERN.test(v);

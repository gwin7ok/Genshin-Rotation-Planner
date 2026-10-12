import React from 'react';
import { X, HelpCircle, Sparkles } from 'lucide-react';

interface UsageGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** 「使い方」の各節（見出し + 箇条書き）。画面の表記に合わせて書く */
const GUIDE_SECTIONS: { title: string; lead?: string; items: React.ReactNode[] }[] = [
  {
    title: '基本の流れ（まずはここから）',
    items: [
      <><b>編成設定</b>を開き、パーティ 4 人（キャラ・命ノ星座・武器・聖遺物）を選ぶ。</>,
      <>画面中ほどの「<b>出場追加</b>」で、出場させるキャラのボタンを押して、<b>出場ブロック</b>（そのキャラの 1 回の出番）を並べる。同じキャラを何度出してもよい。</>,
      <>各出場ブロックの中で、<b>+N +C +tE +hE +Q +D +J +待機</b> などのボタンを押して、アクションを足す。</>,
      <>下の<b>ガントチャート</b>で、時間の流れ・スキルと爆発の CT・効果の長さ・バフの重なり・CT 違反を確認する。</>,
      <>精密な数値が欲しいときは、<b>gcsim で計算</b>を押す（実際のシミュレーターで、所要時間・CT・効果時間・発動バフを実測して反映する）。</>,
      <>気に入ったら、<b>名前をつけて保存</b>（保存編成）。<b>記法コピー</b>で、SNS などに貼れる 1 行の記法も作れる。</>,
    ],
  },
  {
    title: '画面の見方',
    items: [
      <><b>一番上の段</b>: 保存編成の選択・上書き保存・名前をつけて保存 / 再生・リセット（周回数・時刻・速度 0.5x〜2x）/ CT の状態（<span className="text-emerald-300">全体CT違反なし</span>／<span className="text-red-300">CT違反あり</span>／<span className="text-amber-300">CT警告</span>）/ <b>省略</b>（下のボタン列の表示・非表示）。</>,
      <><b>ボタン列</b>: 使い方 / 編成設定・編成管理・DB管理 / gcsim で計算・gcsim設定文をコピー・アプリの計算に戻す / 記法コピー（と、現在の記法の表示。略号／名称の切り替え）。</>,
      <><b>構築エリア</b>（出場ブロックの一覧）: ここで、順番とアクションを編集する。上の「登場順序クイック並び替え」のチップで、出場の順番を一目で変えられる。</>,
      <><b>ガントチャート</b>: 横軸が時間（秒）。上から、出場の流れ・バフの重なりの数（Synergy）・キャラごとの行（アクション・CT・効果・発動バフ）。右上のスライダーで拡大・縮小。</>,
    ],
  },
  {
    title: 'アクションの編集',
    items: [
      <><b>追加の位置</b>: アクションを 1 つクリックで選んでいると、追加ボタンは、その<b>直前</b>に足す（同じ出場ブロックの中）。何も選んでいない・別の出場ブロックを選んでいるときは、末尾に足す。ブロックの背景をクリックすると、選択が外れる。</>,
      <><b>並び替え</b>: アクションをドラッグ＆ドロップ（同じ出場ブロックの中。交代アクションは先頭に固定）。出場ブロックは、カードの<b>ドラッグ移動</b>のつまみ、「上へ／下へ」、クイック並び替えのチップのドラッグ、ガントチャート上のドラッグのどれでもよい。順番を変えると、後ろの時刻は自動でつながる（直列スナップ）。</>,
      <><b>所要時間</b>: 各アクションの所要時間は、欄の ▲▼（0.05 秒・0.1 秒）や数値で変えられる。長押しスキル（hE）は、押す長さも指定できる。変えた値には印が付き、「アプリの計算に戻す」で、すべて元に戻せる。</>,
      <><b>削除</b>: アクションの ✕。出場ブロックは、カード右の削除ボタン（またはクイック並び替えのチップの ×）。</>,
      <><b>メモ追加</b>: 出場ブロックごとに、メモを残せる。</>,
    ],
  },
  {
    title: 'グループ（同じ動きの繰り返し）',
    items: [
      <>アクションを <b>Ctrl+クリック</b>（Mac は Cmd+クリック）で、隣り合うものを選ぶ → 「<b>○ 個をグループ化</b>」。1 つだけ選んだときは「<b>1 個を繰り返す</b>」。</>,
      <>グループの<b>回数</b>（▲▼ や数値）を決めると、中のアクションを、その回数ぶん続けて行ったものとして計算する。初期値は 1。</>,
      <>記法は、<code>3C</code>（1 つのアクションを 3 回）・<code>2[N1C]</code>（N1 と C を 2 回）の形になる。</>,
      <><b>解除</b>を押すと、<b>今の回数のまま</b>、通常のアクションとして並べる（回数 3 なら、3 回ぶんが残る）。</>,
      <>グループの中は、グループの中だけで並び替えられる。グループごと動かすこともできる。</>,
    ],
  },
  {
    title: 'ガントチャートの色と印',
    items: [
      <><b>CT のバー</b>（スキル CT・爆発 CT）: 使ってから、また使えるようになるまでの待ち時間。<b>赤い印</b>のアクションは、<b>CT 違反</b>（CT が明けていないのに使っている）。</>,
      <><b>効果のバー</b>（シールド・領域・変身など）: そのアクションの効果が続いている間。</>,
      <><b>点線の枠のバー</b>（発動バフ）: 固有天賦・武器・聖遺物・命ノ星座の効果。種類で色が違う。<b>持越</b> は、前の周から続いている効果。</>,
      <><b>琥珀色の枠・CT警告</b>: 発動バフが CT 中に発動する配置、特殊スキルが受付時間外にある配置、落下攻撃の前提を満たさない配置など。バーの上にカーソルを合わせると、理由が出る。</>,
      <><b>ループ基準点</b>: 2 周目以降に繰り返す範囲の始まり。ドラッグで動かせる。再生では、1 周目・2 周目の動きを確かめられる。</>,
      <>バーにカーソルを合わせると、名前・時間・説明が出る。</>,
    ],
  },
  {
    title: 'gcsim で計算（実測の反映）',
    items: [
      <>「<b>gcsim で計算</b>」は、今の編成とローテーションを gcsim（ブラウザの中で動く、公式のシミュレーター）で実行し、結果を<b>一括で反映</b>する。サーバーには何も送らない。</>,
      <>反映されるもの: アクションの所要時間・スキルと爆発の CT・効果時間・発動バフの位置と長さ。CT 違反があるときは、実行しない（先に直す）。</>,
      <>反映した値を捨てて、アプリの計算（マスターのフレームと CT）に戻すときは、「<b>アプリの計算に戻す</b>」。</>,
      <>「<b>gcsim設定文をコピー</b>」で、gcsim の設定文を取り出せる（ほかの環境の gcsim で実行したいとき。変換の警告も出る）。</>,
      <>gcsim が対応していないキャラ・効果は、「gcsim対象外」と表示され、アプリの計算のまま残る。</>,
    ],
  },
  {
    title: '保存・バックアップ',
    items: [
      <>編集中の内容は、<b>このブラウザの中に自動で保存</b>される（サーバーには送らない）。ブラウザのデータを消すと、なくなる。</>,
      <><b>編成管理</b>: 名前をつけた保存編成（スロット）の保存・読み込み・削除。1 つの編成を JSON ファイルで書き出す・読み込むこともできる。</>,
      <><b>全データのバックアップ</b>（編成管理 → JSON バックアップ・共有）: 保存編成のすべて・現在の編成・設定・作成したデータを、1 つのファイルにまとめる。別のブラウザ・端末に移すときや、データを消す前に使う。</>,
      <><b>DB管理</b>: キャラ・武器・聖遺物のデータの同期・編集・追加。</>,
    ],
  },
  {
    title: '記法（テキストでの共有）',
    items: [
      <>「<b>記法コピー</b>」で、ローテーションを 1 行の文字列にしてコピーする。例: <code>{'{フリーナ E > シトラリ E > フリーナ Q > 香菱 EQ}'}</code></>,
      <><b>略号</b>（E・Q・N1・C など。詰めて書く）と<b>名称</b>（日本語）を、切り替えられる。</>,
      <><code>{'{ }'}</code> で囲んだ部分は、2 周目以降も繰り返す範囲（ループ基準点より後ろ）。</>,
      <>連続する通常攻撃は <code>N3</code>（3 回）、グループは <code>3C</code> ・ <code>2[N1C]</code>、長押しは <code>hE@2.0s</code> の形。</>,
    ],
  },
];

export const UsageGuideModal: React.FC<UsageGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <HelpCircle className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-white">使い方</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors" title="閉じる">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 本文 */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-sm">
          <p className="text-xs text-slate-400 leading-relaxed">
            原神の戦闘ローテーション（誰が、いつ、何を使うか）を、時間の流れで組み立てて、スキル・爆発の CT とバフの重なりを確かめるツールです。
            編成は、このブラウザの中だけに保存されます。
          </p>
          {GUIDE_SECTIONS.map(section => (
            <section key={section.title} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <h4 className="font-bold text-amber-300 text-xs flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>{section.title}</span>
              </h4>
              <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-outside pl-4 leading-relaxed marker:text-slate-600">
                {section.items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {/* フッター */}
        <div className="flex items-center justify-end px-5 py-3 border-t border-slate-800 bg-slate-950/80">
          <button onClick={onClose} className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition-colors">
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};

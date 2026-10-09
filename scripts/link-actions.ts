/**
 * スキル・爆発の効果と gcsim のキーの紐付けを、既存のマスター（characters_master_data.json）のアクション定義に取り込み直す（D95）。
 * ネットワーク不要。マスターを再生成せずに、中間データ（action_effect_keys.json）や手で補う一覧の変更を反映したいときに使う。
 *
 *   npm run link:actions
 *
 * 新キャラ・gcsim の更新のときの順序: npm run probe:effects → npm run link:effects（gcsim を実行。中間データを作る）→ npm run link:actions（取り込み）。
 * （npm run build:master も、最後に同じ取り込みを行う）
 */
import fs from 'node:fs';
import { linkActions } from './link-buffs.ts';

const path = 'src/data/characters_master_data.json';
const characters = JSON.parse(fs.readFileSync(path, 'utf8'));
linkActions(characters);
fs.writeFileSync(path, JSON.stringify(characters, null, 2) + '\n', 'utf-8');
console.log(`書き込みました: ${path}`);

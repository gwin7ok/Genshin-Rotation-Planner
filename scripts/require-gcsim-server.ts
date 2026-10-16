/**
 * gcsim のサーバー（npm run gcsim:start）が要るスクリプトの先頭で、`import './require-gcsim-server.ts'` する。
 * サーバーに繋がらないときは、「fetch failed」だけで落ちずに、起動の手順を示して終了する（終了コード 1）。
 */
import { GCSIM_SERVER_URL } from '../src/utils/gcsim/gcsimConfig.ts';

try {
  // どんな応答（404 でも）でも、サーバーが起きていることは分かる。繋がらなければ例外
  await fetch(GCSIM_SERVER_URL, { signal: AbortSignal.timeout(3000) });
} catch {
  console.error(`gcsim のサーバーに繋がりません（${GCSIM_SERVER_URL}）。先に、次のコマンドで起動してください:\n\n  npm run gcsim:start\n\n（状態の確認: npm run gcsim:status）`);
  process.exit(1);
}

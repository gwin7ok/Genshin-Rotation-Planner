// AMO（addons.mozilla.org）の署名用の鍵が、使えるかの確認。GitHub Actions の `amo-check`（手動起動）から呼ぶ。
//
// 鍵: 環境変数 AMO_JWT_ISSUER・AMO_JWT_SECRET（GitHub の Secrets。AMO の「API 認証情報」のページの JWT issuer・JWT secret）。
// やること:
//   1. 鍵の「形」だけを表示する（長さ・前後の空白・引用符・issuer が user:数字:数字 の形か・取り違え）。値そのものは、決して表示しない
//   2. web-ext と同じ方式（HS256 の JWT）で、AMO に、副作用のない問い合わせ（GET）をする
//        401 = 鍵が通らない（署名の失敗と同じ原因）／ 404 = 認証は通った（探したアップロードが、無いだけ）
//      secret は、前後の空白の有無を変えて、2 通り試す（登録された値のまま、と、空白の有無を逆にした値）。
//      「コピーすると、前後に空白が付く」「空白が必要なのでは」という疑いを、AMO の答えで確かめるため
// 署名（web-ext sign）は、同じ版を 1 回しか通せないので、鍵の確認のためだけに署名を試さない（docs/リリース手順.md）。
import { createHmac, randomUUID } from 'node:crypto';

const AMO_API = 'https://addons.mozilla.org/api/v5';

export function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

/** web-ext（jsonwebtoken）と同じ形の JWT（HS256）。有効期限は 60 秒 */
export function buildJwt(issuer: string, secret: string, nowSec: number = Math.floor(Date.now() / 1000)): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = { iss: issuer, jti: randomUUID(), iat: nowSec, exp: nowSec + 60 };
  const data = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = createHmac('sha256', secret).update(data).digest();
  return `${data}.${base64url(signature)}`;
}

function describeValue(name: string, value: string): string[] {
  const lines: string[] = [];
  lines.push(`${name}: 長さ ${value.length} 文字`);
  lines.push(`  前後の空白・改行: ${value !== value.trim() ? 'あります' : 'ありません'}`);
  lines.push(`  途中の空白・改行: ${/\s/.test(value.trim()) ? 'あります（要修正）' : 'ありません'}`);
  lines.push(`  引用符で囲まれている: ${/^["'`]|["'`]$/.test(value.trim()) ? 'はい（要修正）' : 'いいえ'}`);
  return lines;
}

/** 鍵の形の説明（値は含めない） */
export function describeShape(issuer: string, secret: string): string[] {
  const lines = [...describeValue('AMO_JWT_ISSUER', issuer)];
  lines.push(`  user:数字:数字 の形: ${/^user:\d+:\d+$/.test(issuer) ? 'はい' : 'いいえ（AMO の JWT issuer は、この形です）'}`);
  lines.push(...describeValue('AMO_JWT_SECRET', secret));
  lines.push(`  前後の空白を除いて、英数字のみ: ${/^[A-Za-z0-9]+$/.test(secret.trim()) ? 'はい' : 'いいえ（見えない文字・記号が、混ざっているかもしれません）'}`);
  if (/^user:/.test(secret.trim())) {
    lines.push('注意: AMO_JWT_SECRET が user: で始まっています。issuer と secret が、逆に登録されているかもしれません');
  }
  return lines;
}

/** secret の試す値: 登録された値のまま、と、前後の空白の有無を逆にした値（ラベルだけを表示し、値は表示しない） */
export function secretVariants(secret: string): { label: string; value: string }[] {
  const trimmed = secret.trim();
  const variants = [{ label: '登録された値のまま', value: secret }];
  if (trimmed !== secret) {
    variants.push({ label: '前後の空白・改行を取り除いた値', value: trimmed });
  } else {
    variants.push({ label: '前後に空白を 1 つずつ付けた値（空白が必要かの確認用）', value: ` ${trimmed} ` });
  }
  return variants;
}

async function probe(issuer: string, secret: string): Promise<{ status: number; detail: string }> {
  const token = buildJwt(issuer, secret);
  const url = `${AMO_API}/addons/upload/${randomUUID()}/`;
  const res = await fetch(url, { headers: { Authorization: `JWT ${token}` } });
  let detail = '';
  try {
    const body = (await res.json()) as { detail?: unknown };
    if (typeof body?.detail === 'string') detail = body.detail;
  } catch {
    // 本文が JSON でなければ、状態だけ表示する
  }
  return { status: res.status, detail };
}

async function main(): Promise<void> {
  const issuer = process.env.AMO_JWT_ISSUER ?? '';
  const secret = process.env.AMO_JWT_SECRET ?? '';
  if (!issuer || !secret) {
    console.error('AMO_JWT_ISSUER / AMO_JWT_SECRET が、空です（Secrets が未登録、または、別の場所（Environment secrets など）に登録されています）');
    process.exit(1);
  }
  console.log('鍵の形（値は表示しません）');
  for (const line of describeShape(issuer, secret)) console.log(line);
  console.log('');

  const variants = secretVariants(secret);
  const results: { label: string; status: number; detail: string }[] = [];
  for (const v of variants) {
    const r = await probe(issuer, v.value);
    results.push({ label: v.label, ...r });
    console.log(`AMO の応答（secret = ${v.label}）: HTTP ${r.status}${r.detail ? ` / ${r.detail}` : ''}`);
  }
  console.log('');

  const [asRegistered, other] = results;
  if (asRegistered.status === 404) {
    console.log('結果: 登録された値のままで、認証は通りました（探したアップロードが無いだけです）。鍵は、有効です');
    return;
  }
  if (other.status === 404) {
    console.error(`結果: 「${other.label}」なら通ります。登録された値は、通りません（署名の失敗と同じ原因です）。Secrets の AMO_JWT_SECRET を、その形で登録し直してください`);
    process.exit(1);
  }
  // AMO は、まず issuer で鍵を探し、見つかったら、secret で署名を検証する。どこで落ちたかで、直す所が分かる
  if (/Unknown JWT iss/i.test(asRegistered.detail)) {
    console.error('結果: issuer（AMO_JWT_ISSUER）が、AMO に登録された鍵ではありません。「JWT 発行者」の値を、登録し直してください');
  } else if (/decoding signature/i.test(asRegistered.detail)) {
    console.error('結果: issuer は、AMO の鍵として認識されました。secret（AMO_JWT_SECRET）が、空白の有無にかかわらず、違います（署名の失敗と同じ原因です）。「JWT 秘密鍵」の値（見えない文字・欠け・別の値）を、確かめてください');
  } else {
    console.error('結果: 鍵が通りません（署名の失敗と同じ原因です）。上の「鍵の形」を見て、登録し直してください');
  }
  process.exit(1);
}

if (import.meta.main) {
  await main();
}

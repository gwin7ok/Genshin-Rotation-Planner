"""試作: HoYoLAB から所持キャラの詳細（生 JSON）を取得して、ファイルに書き出す。

Cookie の値は、画面にもファイルにも出さない。
使い方:
  python fetch_characters.py --browser edge     # ブラウザの Cookie を読む（browser-cookie3 が必要）
  python fetch_characters.py --env              # 環境変数 HOYO_LTUID_V2 / HOYO_LTOKEN_V2 を使う
"""
import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

import genshin


def make_client(args: argparse.Namespace) -> genshin.Client:
    client = genshin.Client(region=genshin.Region.OVERSEAS, lang="ja-jp")
    if args.env:
        ltuid = os.environ.get("HOYO_LTUID_V2")
        ltoken = os.environ.get("HOYO_LTOKEN_V2")
        if not ltuid or not ltoken:
            sys.exit("環境変数 HOYO_LTUID_V2 / HOYO_LTOKEN_V2 が未設定です。")
        client.set_cookies({"ltuid_v2": ltuid, "ltoken_v2": ltoken})
    else:
        client.set_browser_cookies(args.browser)
    return client


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--browser", default="edge", help="chrome / edge / firefox など")
    ap.add_argument("--env", action="store_true")
    ap.add_argument("--uid", type=int, default=None)
    ap.add_argument("--out", default="out/hoyolab-raw.json")
    args = ap.parse_args()

    client = make_client(args)
    uid = args.uid
    if uid is None:
        accounts = await client.get_game_accounts()
        genshin_accounts = [a for a in accounts if a.game == genshin.Game.GENSHIN]
        if not genshin_accounts:
            sys.exit("原神のアカウントが見つかりません。")
        uid = genshin_accounts[0].uid
    print(f"UID 末尾: ...{str(uid)[-3:]}")

    raw = await client.get_genshin_detailed_characters(uid, return_raw_data=True)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(raw, ensure_ascii=False, indent=1), encoding="utf-8")
    chars = raw.get("list", [])
    print(f"取得: {len(chars)} キャラ → {out}")


asyncio.run(main())

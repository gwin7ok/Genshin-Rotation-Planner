chcp 65001

# 出力先ファイルパスの定数定義
$OUTPUT_PATH = "G:\Cursor_Folder\Genshin-Rotation-Planner\Genshin-Rotation-Planner\urls.txt"

# 一時的に浅いクローンを作成
git clone --depth 1 -b main --filter=blob:none https://github.com/gwin7ok/Genshin-Rotation-Planner.git temp_repo
Set-Location temp_repo

# 全ファイルのURL一覧を作成（直接 Raw URL を生成）
$urls = git ls-tree -r --name-only HEAD | ForEach-Object {
    "https://raw.githubusercontent.com/gwin7ok/Genshin-Rotation-Planner/main/$_"
}
$urls | Out-File -FilePath $OUTPUT_PATH -Encoding utf8

# 一時フォルダを削除して元の場所に戻る
Set-Location ..
Remove-Item -Recurse -Force temp_repo
Write-Host "完了: $($urls.Count) 件の Raw URL を $OUTPUT_PATH に保存しました。" -ForegroundColor Green
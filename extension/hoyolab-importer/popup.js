const $ = (id) => document.getElementById(id);
$('go').addEventListener('click', () => {
  const uid = $('uid').value.trim();
  if (!/^\d{9}$/.test(uid)) { $('msg').textContent = 'UID は 9 桁の数字です'; return; }
  $('msg').textContent = '取得中…';
  chrome.runtime.sendMessage({ type: 'hoyolab-fetch', uid }, (res) => {
    if (chrome.runtime.lastError) { $('msg').textContent = '失敗: ' + chrome.runtime.lastError.message; return; }
    if (!res.ok) { $('msg').textContent = '失敗: ' + res.error; return; }
    const blob = new Blob([JSON.stringify(res.data, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'hoyolab-raw-extension.json';
    a.click();
    $('msg').textContent = `完了: ${res.data.list.length} キャラを保存しました`;
  });
});

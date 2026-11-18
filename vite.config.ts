import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

// アプリの版（package.json の version。唯一の出どころ）と、ビルドしたコミット（画面のフッター・バックアップに記録する）
const APP_VERSION: string = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf8')).version;
// アプリに同梱する拡張機能の版（拡張機能の manifest.json の version。取り込み画面で、入っている拡張機能が古いときに更新をうながす）
const EXTENSION_VERSION: string = JSON.parse(readFileSync(path.resolve(__dirname, 'extension/hoyolab-importer/manifest.json'), 'utf8')).version;
const APP_COMMIT: string = (() => {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: __dirname, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return (process.env.GITHUB_SHA ?? '').slice(0, 7) || 'unknown';
  }
})();

export default defineConfig(() => {
  return {
    root: __dirname,
    // 公開先の URL のパス（GitHub Pages のプロジェクトサイトは /<リポジトリ名>/）。開発・独自ドメインは '/'
    base: process.env.VITE_BASE || '/',
    plugins: [
      react(),
      tailwindcss(),
      {
        // 拡張機能の版（manifest.json）が変わったら、開発サーバーを再起動して、__EXTENSION_VERSION__ を読み直す
        name: 'restart-on-extension-manifest',
        configureServer(server) {
          const manifest = path.resolve(__dirname, 'extension/hoyolab-importer/manifest.json');
          server.watcher.add(manifest);
          server.watcher.on('change', (f) => { if (path.resolve(f) === manifest) void server.restart(); });
        },
      },
      {
        // 開発サーバーは、存在しないファイルにも、index.html（画面の戻り先）を 200 で返す。downloads/ の下の、まだ無い拡張機能
        // （署名済みの .xpi など）をダウンロードすると、HTML が .xpi として保存され、Firefox が「壊れているため、インストールできません」と出す。
        // downloads/ の下で、無いファイルは、404 にする（公開サイトの GitHub Pages は、もとから 404）
        name: 'downloads-not-found',
        configureServer(server) {
          const dir = path.resolve(__dirname, 'public', 'downloads');
          server.middlewares.use((req, res, next) => {
            let pathname = '';
            try { pathname = decodeURIComponent((req.url ?? '').split('?')[0]); } catch { /* 読めない URL は、そのまま次へ */ }
            const prefix = `${server.config.base}downloads/`;
            if (pathname.startsWith(prefix)) {
              const file = path.resolve(dir, pathname.slice(prefix.length));
              if (!file.startsWith(dir + path.sep) || !existsSync(file)) {
                res.statusCode = 404;
                res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                res.end('Not Found');
                return;
              }
            }
            next();
          });
        },
      },
    ],
    define: {
      __APP_VERSION__: JSON.stringify(APP_VERSION),
      __EXTENSION_VERSION__: JSON.stringify(EXTENSION_VERSION),
      __APP_COMMIT__: JSON.stringify(APP_COMMIT),
    },
    json: {
      stringify: true,
    },
    build: {
      chunkSizeWarningLimit: 25000,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      // gcsim の WebAssembly 版（44MB。npm run wasm:build が書き換える）は監視しない（書き込み中の EBUSY で開発サーバーが落ちるため）
      watch: process.env.DISABLE_HMR === 'true' ? null : { ignored: ['**/public/gcsim/main.wasm', '**/public/gcsim/wasm_exec.js', '**/public/gcsim/wasm-info.json'] },
    },
  };
});

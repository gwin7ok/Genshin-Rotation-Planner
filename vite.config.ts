import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

// アプリの版（package.json の version。唯一の出どころ）と、ビルドしたコミット（画面のフッター・バックアップに記録する）
const APP_VERSION: string = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf8')).version;
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
    plugins: [react(), tailwindcss()],
    define: {
      __APP_VERSION__: JSON.stringify(APP_VERSION),
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

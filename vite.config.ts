import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    root: __dirname,
    plugins: [react(), tailwindcss()],
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

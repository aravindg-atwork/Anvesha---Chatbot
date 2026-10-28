import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';
import { chatApiPlugin } from './server/chatApi.ts';

export default defineConfig(({ mode }) => {
  // Non-VITE_ variables stay on the server: they are never bundled into browser code.
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), tailwindcss(), ...(env.ANVESHA_API_URL ? [] : [chatApiPlugin({ apiKey: env.ANTHROPIC_API_KEY, model: env.ANTHROPIC_MODEL })])],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: env.ANVESHA_API_URL ? { proxy: { '/api': { target: env.ANVESHA_API_URL, changeOrigin: false } } } : undefined,
    test: { environment: 'node', include: ['src/**/*.test.ts', 'server/**/*.test.ts'] },
  };
});

import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { chatApiPlugin } from './server/chatApi.ts';

export default defineConfig(({ mode }) => {
  // Non-VITE_ variables stay on the server: they are never bundled into browser code.
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), chatApiPlugin({ apiKey: env.ANTHROPIC_API_KEY, model: env.ANTHROPIC_MODEL })],
    test: { environment: 'node', include: ['src/**/*.test.ts', 'server/**/*.test.ts'] },
  };
});

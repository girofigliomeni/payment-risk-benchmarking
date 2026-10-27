import { defineConfig, loadEnv } from 'vite';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '../..', 'VITE_');
  return { envDir: '../..', server: { strictPort: true, proxy: {
    '/sandbox': { target: env.VITE_API_BASE_URL || 'http://127.0.0.1:3001', changeOrigin: false },
  } } };
});

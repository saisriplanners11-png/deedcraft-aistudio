import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createProxyHandler } from './proxy.mjs';

// The Anthropic key stays server-side. It is deliberately NOT passed to
// `define`, so it never appears in the client bundle — the browser talks to
// /api/anthropic and this plugin attaches the key on the way out.
function aiProxy(env: Record<string, string>): Plugin {
  const getConfig = () => ({
    anthropicApiKey: env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY,
    geminiApiKey: env.GEMINI_API_KEY || process.env.GEMINI_API_KEY,
    extractionProvider: (env.EXTRACTION_PROVIDER || process.env.EXTRACTION_PROVIDER || 'anthropic').toLowerCase(),
    geminiModel: env.GEMINI_MODEL || process.env.GEMINI_MODEL || 'gemini-3.6-flash',
    draftModel: env.DRAFT_MODEL || process.env.DRAFT_MODEL || 'claude-sonnet-4-6',
  });
  const handler = createProxyHandler(getConfig);
  return {
    name: 'anthropic-proxy',
    configureServer: server => void server.middlewares.use(handler),
    configurePreviewServer: server => void server.middlewares.use(handler),
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const geminiExtraction = env.EXTRACTION_PROVIDER?.toLowerCase() === 'gemini';
  const geminiModel = env.GEMINI_MODEL || 'gemini-3.6-flash';
  const geminiExtractModel = env.GEMINI_EXTRACT_MODEL || geminiModel;
  const geminiVisionModel = env.GEMINI_VISION_MODEL || geminiModel;
  const geminiVerifyModel = env.GEMINI_VERIFY_MODEL || geminiVisionModel;
  return {
    plugins: [react(), aiProxy(env)],
    define: {
      // Model choice is not a secret, so it can be baked in.
      'process.env.EXTRACT_MODEL': JSON.stringify(geminiExtraction ? geminiExtractModel : (env.EXTRACT_MODEL ?? '')),
      'process.env.DRAFT_MODEL': JSON.stringify(env.DRAFT_MODEL ?? ''),
      'process.env.VISION_MODEL': JSON.stringify(geminiExtraction ? geminiVisionModel : (env.VISION_MODEL ?? '')),
      'process.env.VERIFY_MODEL': JSON.stringify(geminiExtraction ? geminiVerifyModel : (env.VERIFY_MODEL ?? '')),
    },
    server: { port: 5173, open: true },
    build: { outDir: 'dist', sourcemap: true },
  };
});

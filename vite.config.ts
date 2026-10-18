import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';
import { createProxyHandler } from './proxy.mjs';
import { createReferencePlanApi } from './reference-plan/api.mjs';
import { createTemplateApi } from './template-api.mjs';

function templateLibraryApi(env: Record<string, string>): Plugin {
  let handler: ReturnType<typeof createTemplateApi>;
  const getHandler = () => handler ||= createTemplateApi({ storageDir: env.TEMPLATE_STORAGE_DIR || process.env.TEMPLATE_STORAGE_DIR, password: env.TEMPLATE_ADMIN_PASSWORD || process.env.TEMPLATE_ADMIN_PASSWORD, backend: env.TEMPLATE_STORAGE_BACKEND || process.env.TEMPLATE_STORAGE_BACKEND, supabaseUrl: env.SUPABASE_URL || process.env.SUPABASE_URL, supabaseKey: env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY, supabaseBucket: env.SUPABASE_TEMPLATE_BUCKET || process.env.SUPABASE_TEMPLATE_BUCKET });
  return {
    name: 'template-library-api',
    configureServer: server => void server.middlewares.use(getHandler()),
    configurePreviewServer: server => void server.middlewares.use(getHandler()),
  };
}

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

function referencePlanApi(env: Record<string, string>): Plugin {
  const previous = process.env.GEMINI_API_KEY;
  if (env.GEMINI_API_KEY && !previous) process.env.GEMINI_API_KEY = env.GEMINI_API_KEY;
  const api = createReferencePlanApi();
  return {
    name: 'reference-plan-api',
    configureServer: server => void server.middlewares.use(api),
    configurePreviewServer: server => void server.middlewares.use(api),
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
    plugins: [react(), tailwindcss(), templateLibraryApi(env), aiProxy(env), referencePlanApi(env)],
    define: {
      // Model choice is not a secret, so it can be baked in.
      'process.env.EXTRACT_MODEL': JSON.stringify(geminiExtraction ? geminiExtractModel : (env.EXTRACT_MODEL ?? '')),
      'process.env.DRAFT_MODEL': JSON.stringify(env.DRAFT_MODEL ?? ''),
      'process.env.VISION_MODEL': JSON.stringify(geminiExtraction ? geminiVisionModel : (env.VISION_MODEL ?? '')),
      'process.env.VERIFY_MODEL': JSON.stringify(geminiExtraction ? geminiVerifyModel : (env.VERIFY_MODEL ?? '')),
    },
    server: { port: 5173, open: false, watch: { ignored: ['**/tmp/**', '**/output/**', '**/template-storage/**'] }, fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/template-storage/**', resolve(env.TEMPLATE_STORAGE_DIR || process.env.TEMPLATE_STORAGE_DIR || 'template-storage').replace(/\\/g, '/') + '/**'] } },
    build: { outDir: 'dist', sourcemap: true, rollupOptions: { input: { main: resolve(__dirname, 'index.html'), referencePlan: resolve(__dirname, 'reference-plan/index.html'), exactReferencePlan: resolve(__dirname, 'exact-reference-plan/index.html') } } },
  };
});

/// <reference types="vitest/config" />
import { availableParallelism } from 'node:os';
import { defineConfig, type Plugin } from 'vite';

/**
 * Inline the bundled JS and CSS into index.html, so the build is one self-contained file. Anyone can download it
 * and double-click it: browsers refuse to load separate module scripts from file://, but an inline one runs fine.
 */
function singleFile(): Plugin {
  return {
    name: 'tapeout-single-file',
    enforce: 'post',
    generateBundle(_, bundle) {
      const page = bundle['index.html'];
      if (!page || page.type !== 'asset') return;
      let html = String(page.source);
      for (const [name, file] of Object.entries(bundle)) {
        const ref = new RegExp(`<(script|link)[^>]*(src|href)="\\./${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>(</script>)?`);
        if (!ref.test(html)) continue;
        if (file.type === 'chunk') {
          // A literal "</script" inside the code would end the inline tag early; "<\/script" means the same thing to JS.
          // Vite's dynamic-import helper takes a list of chunks to preload; in one file there are none.
          const code = file.code.replace(/<\/script/gi, '<\\/script').replace(/__VITE_PRELOAD__/g, 'void 0');
          html = html.replace(ref, () => `<script type="module">${code}</script>`);
        } else if (name.endsWith('.css')) {
          html = html.replace(ref, () => `<style>${String(file.source)}</style>`);
        } else continue;
        delete bundle[name];
      }
      page.source = html;
    },
  };
}

/**
 * Two builds from one source. The default is the single HTML file for the release download (dynamic imports are
 * inlined, so it still runs from file://). `--mode hosted` is a normal multi-file build whose lab pages are separate
 * chunks, which the browser caches and compiles only when a lab opens.
 */
export default defineConfig(({ mode }) => ({
  base: './',
  build: {
    target: 'es2022',
    assetsInlineLimit: mode === 'hosted' ? 4096 : Number.MAX_SAFE_INTEGER,
    rollupOptions: mode === 'hosted' ? {} : { output: { inlineDynamicImports: true } },
    outDir: mode === 'hosted' ? 'dist-hosted' : 'dist',
  },
  plugins: mode === 'hosted' ? [] : [singleFile()],
  // The suite is CPU-bound and cut into similar-sized files: one worker per core (the default leaves one core idle).
  test: { maxWorkers: Math.max(2, availableParallelism()) },
}));

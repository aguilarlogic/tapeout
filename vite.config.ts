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
          const code = file.code.replace(/<\/script/gi, '<\\/script');
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

export default defineConfig({
  base: './',
  build: { target: 'es2022', assetsInlineLimit: Number.MAX_SAFE_INTEGER },
  plugins: [singleFile()],
});

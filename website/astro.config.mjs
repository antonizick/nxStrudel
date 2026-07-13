import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import remarkToc from 'remark-toc';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeUrls from 'rehype-urls';
import bundleAudioWorkletPlugin from 'vite-plugin-bundle-audioworklet';

import tailwind from '@astrojs/tailwind';
import AstroPWA from '@vite-pwa/astro';

import process from 'node:process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Dev-only bridge letting Claude Code read/write the live pattern via a shared file,
// so `bridge/pattern.strudel` at the repo root is the sync point between editor and REPL.
// Override BRIDGE_DIR for a disposable verification instance so it doesn't collide with
// whatever pattern is live in Nick's real session.
function strudelBridgePlugin() {
  const bridgeDir = process.env.BRIDGE_DIR || fileURLToPath(new URL('../bridge', import.meta.url));
  const bridgeFile = path.join(bridgeDir, 'pattern.strudel');
  // Same idea as the pattern bridge above, but for a freeform markdown notes file — lets
  // the Notes tab read/write `bridge/notes.md` on disk instead of only in browser storage.
  const notesFile = path.join(bridgeDir, 'notes.md');

  function fileRoute(server, route, file) {
    server.middlewares.use(route, (req, res) => {
      if (req.method === 'GET') {
        let code = '';
        let mtimeMs = 0;
        try {
          code = fs.readFileSync(file, 'utf8');
          mtimeMs = fs.statSync(file).mtimeMs;
        } catch {
          // nothing written yet
        }
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ code, mtimeMs }));
        return;
      }
      if (req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          try {
            const { code } = JSON.parse(body);
            fs.writeFileSync(file, code ?? '');
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true, mtimeMs: fs.statSync(file).mtimeMs }));
          } catch (e) {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, error: e.message }));
          }
        });
        return;
      }
      res.statusCode = 405;
      res.end();
    });
  }

  return {
    name: 'strudel-bridge',
    configureServer(server) {
      fs.mkdirSync(bridgeDir, { recursive: true });
      fileRoute(server, '/bridge/pattern', bridgeFile);
      fileRoute(server, '/bridge/notes', notesFile);
    },
  };
}

const site = process.env.SITE_URL || `https://strudel.cc/`; // root url without a path
const base = process.env.BASE_PATH || ''; // base path of the strudel site

const baseNoTrailing = base.endsWith('/') ? base.slice(0, -1) : base;

// this rehype plugin fixes relative links
// it works by prepending the base + page path to anchor links
// and by prepending the base path to other relative links starting with /
// this is necessary when using a base href like <base href={base} />
// examples with base as "mybase":
//   #gain -> /mybase/learn/effects/#gain
//   /some/page -> /mybase/some/page
function relativeURLFix() {
  return (tree, file) => {
    const chunks = file.history[0].split('/src/pages/'); // file.history[0] is the file path
    const path = chunks[chunks.length - 1].slice(0, -4); // only path inside src/pages, without .mdx
    return rehypeUrls((url) => {
      let newHref = baseNoTrailing;
      if (url.href.startsWith('#')) {
        // special case: a relative anchor link to the current page
        newHref += `/${path}/${url.href}`;
      } else if (url.href.startsWith('/')) {
        // any other relative url starting with /
        newHref += url.pathname;
        if (url.pathname.indexOf('.') == -1) {
          // append trailing slash to resource only if there is no file extension
          newHref += url.pathname.endsWith('/') ? '' : '/';
        }
        newHref += url.search || '';
        newHref += url.hash || '';
      } else {
        // leave this URL alone
        return;
      }
      // console.log(url.href + ' -> ', newHref);
      return newHref;
    })(tree);
  };
}
const options = {
  // See https://mdxjs.com/advanced/plugins
  remarkPlugins: [
    remarkToc,
    // E.g. `remark-frontmatter`
  ],
  rehypePlugins: [rehypeSlug, [rehypeAutolinkHeadings, { behavior: 'append' }], relativeURLFix],
};

// https://astro.build/config
export default defineConfig({
  devToolbar: { enabled: false },
  integrations: [
    react(),
    mdx(options),
    tailwind(),
    AstroPWA({
      experimental: { directoryAndTrailingSlashHandler: true },
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        maximumFileSizeToCacheInBytes: 4194304, // 4MB
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,wav,mp3,ogg,ttf,woff2,TTF,otf}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              [
                /^https:\/\/raw\.githubusercontent\.com\/.*/i,
                /^https:\/\/strudel\.b-cdn\.net\/.*/i,
                /^https:\/\/freesound\.org\/.*/i,
                /^https:\/\/cdn\.freesound\.org\/.*/i,
                /^https:\/\/shabda\.ndre\.gr\/.*/i,
              ].some((regex) => regex.test(url)),
            handler: 'CacheFirst',
            options: {
              cacheName: 'external-samples',
              expiration: {
                maxEntries: 5000,
                maxAgeSeconds: 60 * 60 * 24 * 30, // <== 14 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
      manifest: {
        includeAssets: ['favicon.ico', 'icons/apple-icon-180.png'],
        name: 'Strudel REPL',
        short_name: 'Strudel',
        description:
          'Strudel is a music live coding environment for the browser, porting the TidalCycles pattern language to JavaScript.',
        theme_color: '#222222',
        icons: [
          {
            src: 'icons/manifest-icon-192.maskable.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/manifest-icon-192.maskable.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: 'icons/manifest-icon-512.maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/manifest-icon-512.maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  site,
  base,
  vite: {
    plugins: [bundleAudioWorkletPlugin(), strudelBridgePlugin()],
    ssr: {
      // Example: Force a broken package to skip SSR processing, if needed
      // external: ['fraction.js'], // https://github.com/infusion/Fraction.js/issues/51
    },
  },
});

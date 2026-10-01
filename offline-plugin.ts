import { createHash } from "node:crypto";
import type { Plugin } from "vite";

// Precache only our shipped app. Public map providers are not bulk-downloaded
// or cached, and no backend is needed for offline reloads on GitHub Pages.
export function offlinePlugin(): Plugin {
  return {
    name: "offline-app-shell",
    apply: "build",
    enforce: "post",
    generateBundle(_, bundle) {
      const files = Object.keys(bundle).filter(
        (name) => !name.endsWith(".map"),
      );
      const hash = createHash("sha256");
      for (const name of files.sort()) {
        const item = bundle[name];
        hash
          .update(name)
          .update(item.type === "chunk" ? item.code : item.source);
      }
      const version = hash.digest("hex").slice(0, 16);
      this.emitFile({
        type: "asset",
        fileName: "sw.js",
        source: `
const scope = new URL(self.registration.scope);
const prefix = 'gw-shell:' + scope.pathname + ':';
const cacheName = prefix + '${version}';
const assets = ${JSON.stringify(files)}.map(path => new URL(path, scope).href);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(assets)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith(prefix) && key !== cacheName).map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  const shell = event.request.mode === 'navigate' && (url.pathname === scope.pathname || url.pathname === scope.pathname + 'index.html');
  if (!shell && !assets.includes(url.href)) return;
  event.respondWith(caches.open(cacheName).then(async cache => {
    // App files are immutable build outputs. Ignore Vary: Origin from static
    // hosts; precache requests and module requests can carry different Origin
    // headers, which would otherwise miss the cache during an offline reload.
    return (await cache.match(shell ? new URL('index.html', scope).href : event.request, { ignoreVary: true })) || fetch(event.request);
  }));
});
`,
      });
    },
  };
}

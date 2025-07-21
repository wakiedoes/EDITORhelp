// sw.js

const CACHE_NAME = 'dev-helper-cache-v3'; // Naikkan versi lagi untuk lebih aman
const PREVIEW_PREFIX = '/preview-runtime/';

self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

let fileMap = new Map();
let consoleHijacker = '';

self.addEventListener('message', event => {
  if (event.data?.action === 'updateFiles') {
    fileMap = new Map(event.data.files);
    consoleHijacker = event.data.consoleHijacker || '';
    if (event.ports[0]) {
      event.ports[0].postMessage({ status: 'ok' });
    }
  }
});

const getMimeType = (path) => {
  if (path.endsWith('.html')) return 'text/html';
  if (path.endsWith('.css')) return 'text/css';
  if (path.endsWith('.js')) return 'application/javascript';
  if (/\.(png)$/i.test(path)) return 'image/png';
  if (/\.(jpe?g)$/i.test(path)) return 'image/jpeg';
  if (/\.(gif)$/i.test(path)) return 'image/gif';
  if (/\.(svg)$/i.test(path)) return 'image/svg+xml';
  if (/\.(webp)$/i.test(path)) return 'image/webp';
  return 'application/octet-stream';
};

async function dataUrlToBlob(dataUrl) {
    const res = await fetch(dataUrl);
    return await res.blob();
}

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (url.pathname.startsWith(PREVIEW_PREFIX)) {
    event.respondWith(async function() {
      const filePath = url.pathname.substring(PREVIEW_PREFIX.length);
      const targetPath = filePath === '' ? 'index.html' : filePath;

      if (!fileMap.has(targetPath)) {
        return new Response(`File not found: ${targetPath}`, { status: 404 });
      }

      let content = fileMap.get(targetPath).content;
      const mimeType = getMimeType(targetPath);
      const headers = { 'Content-Type': mimeType, 'Access-Control-Allow-Origin': '*' };

      if (mimeType.startsWith('image/') && typeof content === 'string' && content.startsWith('data:')) {
        const blob = await dataUrlToBlob(content);
        return new Response(blob, { headers });
      }

      if (targetPath.endsWith('.html') && consoleHijacker) {
        content = content.replace(/<head>/i, '<head>' + consoleHijacker);
      }
      return new Response(content, { headers });
    }());
  } else {
    // Untuk file aplikasi utama, langsung dari network agar selalu terbaru
    return fetch(event.request);
  }
});

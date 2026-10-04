import { LOGO_SVG } from "@/lib/site"

export const dynamic = "force-static"

// A new value on every deploy changes the worker's bytes, which is how the
// browser notices an update.
const VERSION =
  process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? String(Date.now())

const OFFLINE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#1b2233">
<title>Offline · MyCodePad</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: #0f172a; color: #e2e8f0; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 22rem; padding: 2rem 1.5rem; text-align: center; }
  .logo { width: 72px; height: 72px; margin: 0 auto 1.5rem; }
  h1 { margin: 0 0 .5rem; font-size: 1.25rem; font-weight: 600; color: #f8fafc; }
  p { margin: 0 0 1.5rem; font-size: .95rem; line-height: 1.5; color: #94a3b8; }
  button { border: 0; border-radius: .5rem; padding: .625rem 1.25rem; font: inherit; font-weight: 500;
    background: #3b82f6; color: #fff; cursor: pointer; }
  button:focus-visible { outline: 2px solid #93c5fd; outline-offset: 2px; }
</style>
</head>
<body>
<main>
  <div class="logo" aria-hidden="true">${LOGO_SVG}</div>
  <h1>You&rsquo;re offline</h1>
  <p>Some MyCodePad features require an internet connection. Your work is saved in the cloud, so reconnect to pick up where you left off.</p>
  <button type="button" onclick="location.reload()">Try again</button>
</main>
<script>window.addEventListener("online", function () { location.reload() })</script>
</body>
</html>`

const SOURCE = `/* MyCodePad service worker */
const VERSION = ${JSON.stringify(VERSION)};
const STATIC_CACHE = "mcp-static-" + VERSION;
const ASSET_CACHE = "mcp-assets-" + VERSION;
const PRECACHE = ["/icon.svg", "/pwa-icon/192", "/pwa-icon/512"];
const OFFLINE_HTML = ${JSON.stringify(OFFLINE_HTML)};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(ASSET_CACHE).then((cache) => cache.addAll(PRECACHE)).catch(() => {})
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith("mcp-") && key !== STATIC_CACHE && key !== ASSET_CACHE)
        .map((key) => caches.delete(key))
    );
    if (self.registration.navigationPreload) {
      await self.registration.navigationPreload.enable();
    }
    await self.clients.claim();
  })());
});

function isPublicAsset(pathname) {
  return (
    pathname === "/icon.svg" ||
    pathname.startsWith("/pwa-icon/") ||
    pathname.startsWith("/apple-icon") ||
    pathname.startsWith("/icon1") ||
    pathname.startsWith("/images/") ||
    /\\.(woff2?|ttf|otf)$/.test(pathname)
  );
}

function cacheable(response) {
  return response && response.ok && response.type === "basic";
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (cacheable(response)) cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (cacheable(response)) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || network;
}

// Pages carry signed-in data, so they always come from the network and are
// never stored. Without a connection the user gets a small offline page.
async function handleNavigation(event) {
  try {
    const preloaded = await event.preloadResponse;
    if (preloaded) return preloaded;
    return await fetch(event.request);
  } catch (error) {
    return new Response(OFFLINE_HTML, {
      status: 503,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  if (request.headers.has("range")) return;

  const url = new URL(request.url);
  // The Pyodide CDN, Stripe and every other origin go straight to the network.
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(event));
    return;
  }
  // Build output is content-hashed and identical for every user.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }
  if (isPublicAsset(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, ASSET_CACHE));
  }
  // Anything else (API routes, server actions, RSC payloads, the Python
  // worker) is left untouched.
});
`

export function GET() {
  return new Response(SOURCE, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  })
}

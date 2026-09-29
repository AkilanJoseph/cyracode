// Static file server for the production build in dist/.
//
// Mirrors the reference Nginx config in ../deploy/nginx.conf so that what you
// verify locally matches what the CDN/Nginx layer does in production:
//
//   1. Hashed build output under /assets/ is cached for a year as immutable,
//      because the filename changes whenever the content does.
//   2. index.html is never cached, because it names every hashed asset and a
//      stale copy would keep pointing at files that no longer exist.
//   3. The SPA fallback applies ONLY to extensionless paths. A missing
//      /assets/app.js returns 404 instead of index.html, so a stale deploy
//      surfaces as a clean 404 rather than "Unexpected token '<'" in the
//      browser console.
//
// Usage:
//   npm run build && npm run serve
//   PORT=8080 HOST=0.0.0.0 npm run serve
//   SERVE_API_TARGET=http://127.0.0.1:8000 npm run serve   # optional /api proxy
import http from 'node:http'
import https from 'node:https'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT || 3000)
const HOST = process.env.HOST || '127.0.0.1'
const DIST = path.join(__dirname, 'dist')
const INDEX = path.join(DIST, 'index.html')

// Optional reverse proxy. The current production build bakes an absolute
// VITE_API_BASE_URL (see .env.production), so the app calls the API host
// directly and never needs /api. Set this only when testing a build that was
// made with a relative base such as VITE_API_BASE_URL=/api.
const API_TARGET = process.env.SERVE_API_TARGET

const IMMUTABLE = 'public, max-age=31536000, immutable'
const NO_CACHE = 'no-cache'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',
}

const contentType = (filePath) => MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream'

/** Resolves a URL pathname to a file inside DIST, or null if it escapes. */
function resolveWithinDist(pathname) {
  let decoded
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    return null
  }
  const root = path.resolve(DIST)
  const full = path.resolve(root, decoded.replace(/^\/+/, ''))
  // Defence in depth: the URL parser already collapses "..", but never let a
  // crafted path read files outside dist/.
  if (full !== root && !full.startsWith(root + path.sep)) return null
  return full
}

async function sendFile(req, res, filePath, cacheControl) {
  let stat
  try {
    stat = await fsp.stat(filePath)
    if (!stat.isFile()) throw new Error('not a file')
  } catch {
    return sendNotFound(req, res)
  }
  // Content-Length is sent for GET as well as HEAD so clients get accurate
  // progress and caching behaviour instead of a chunked response.
  res.writeHead(200, {
    'Content-Type': contentType(filePath),
    'Cache-Control': cacheControl,
    'Content-Length': String(stat.size),
    'Last-Modified': stat.mtime.toUTCString(),
  })
  if (req.method === 'HEAD') return res.end()
  fs.createReadStream(filePath)
    .on('error', () => res.destroy())
    .pipe(res)
}

/**
 * The SPA fallback. Only reachable for extensionless paths - anything that
 * looks like a file has already been given a real 404 by the caller.
 */
async function sendIndex(req, res) {
  if (!fs.existsSync(INDEX)) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
    return res.end('dist/index.html is missing. Run `npm run build` first.')
  }
  return sendFile(req, res, INDEX, NO_CACHE)
}

function sendNotFound(req, res) {
  res.writeHead(404, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': NO_CACHE,
  })
  res.end(req.method === 'HEAD' ? undefined : '404 Not Found')
}

/** Optional /api reverse proxy, mirroring the Vite dev-server rewrite. */
function proxyApi(req, res) {
  const target = new URL(req.url, API_TARGET)
  // Strip the /api prefix, matching vite.config.js so both behave the same.
  target.pathname = target.pathname.replace(/^\/api/, '') || '/'
  const client = target.protocol === 'https:' ? https : http
  const upstream = client.request(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (target.protocol === 'https:' ? 443 : 80),
      method: req.method,
      path: target.pathname + target.search,
      headers: { ...req.headers, host: target.host },
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers)
      upstreamRes.pipe(res)
    }
  )
  upstream.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end(`502 Bad Gateway - ${err.message}`)
  })
  req.pipe(upstream)
}

if (!fs.existsSync(INDEX)) {
  console.error('dist/index.html not found. Run `npm run build` first.')
  process.exit(1)
}

http
  .createServer(async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8' })
      return res.end('405 Method Not Allowed')
    }

    const { pathname } = new URL(req.url, `http://${req.headers.host || 'localhost'}`)

    if (API_TARGET && (pathname === '/api' || pathname.startsWith('/api/'))) {
      return proxyApi(req, res)
    }

    const filePath = resolveWithinDist(pathname)
    if (!filePath) return sendNotFound(req, res)

    // The entry document is always served uncached, whichever URL reached it.
    if (filePath === INDEX) return sendIndex(req, res)

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const isHashedAsset = pathname.startsWith('/assets/')
      return sendFile(req, res, filePath, isHashedAsset ? IMMUTABLE : NO_CACHE)
    }

    // Missing file that has an extension: a real 404, never the SPA fallback.
    if (path.extname(pathname)) return sendNotFound(req, res)

    return sendIndex(req, res)
  })
  .listen(PORT, HOST, () => {
    console.log(`CyraCode dist/ served on http://${HOST}:${PORT}  (root: ${DIST})`)
    console.log('  /assets/*  Cache-Control: public, max-age=31536000, immutable')
    console.log('  /          Cache-Control: no-cache  (SPA fallback, no-cache)')
    console.log(`  /api proxy ${API_TARGET ? `-> ${API_TARGET}` : 'disabled (set SERVE_API_TARGET to enable)'}`)
  })

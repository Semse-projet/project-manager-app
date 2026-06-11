import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, '../apps/angular/dist/angular/browser');
const INDEX_FILE = path.join(DIST_DIR, 'index.html');
const HOST = process.env.HOST ?? '0.0.0.0';
const PORT = Number(process.env.PORT ?? '4300');
const API_BASE_URL = resolveApiBaseUrl(process.env.SEMSE_API_URL ?? 'http://127.0.0.1:4000');
const ALLOWED_API_HOSTS = new Set(
  (process.env.SEMSE_API_ALLOWED_HOSTS ?? '127.0.0.1,localhost,::1')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean),
);

const MIME_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.txt', 'text/plain; charset=utf-8'],
]);

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function contentTypeFor(filePath) {
  return MIME_TYPES.get(path.extname(filePath).toLowerCase()) ?? 'application/octet-stream';
}

function resolveApiBaseUrl(rawUrl) {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('SEMSE_API_URL must use http or https');
  }
  parsed.pathname = parsed.pathname.replace(/\/+$/, '/');
  parsed.search = '';
  parsed.hash = '';
  return parsed;
}

function isAllowedApiTarget(target) {
  return target.origin === API_BASE_URL.origin && ALLOWED_API_HOSTS.has(target.hostname.toLowerCase());
}

function resolveStaticPath(urlPathname) {
  const normalized = decodeURIComponent(urlPathname.split('?')[0] || '/');
  const relativePath = normalized === '/' ? 'index.html' : normalized.replace(/^\/+/, '');
  const candidate = path.resolve(DIST_DIR, relativePath);
  if (!candidate.startsWith(DIST_DIR)) {
    return null;
  }
  return candidate;
}

function proxyApi(req, res) {
  let target;
  try {
    // El cliente solo aporta path+query; el origin del destino siempre es API_BASE_URL
    const requested = new URL(req.url, 'http://request.invalid');
    target = new URL(`${requested.pathname}${requested.search}`, API_BASE_URL.origin);
  } catch (error) {
    send(
      res,
      502,
      JSON.stringify({ error: 'api_proxy_invalid_target', message: error.message }),
      { 'Content-Type': 'application/json; charset=utf-8' },
    );
    return;
  }

  if (!isAllowedApiTarget(target)) {
    send(
      res,
      403,
      JSON.stringify({ error: 'api_proxy_target_forbidden' }),
      { 'Content-Type': 'application/json; charset=utf-8' },
    );
    return;
  }

  const client = target.protocol === 'https:' ? https : http;
  const proxyReq = client.request(
    target,
    {
      method: req.method,
      headers: {
        ...req.headers,
        host: target.host,
      },
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );

  proxyReq.on('error', (error) => {
    send(
      res,
      502,
      JSON.stringify({ error: 'api_proxy_failed', message: error.message }),
      { 'Content-Type': 'application/json; charset=utf-8' },
    );
  });

  req.pipe(proxyReq);
}

const server = http.createServer((req, res) => {
  if (!req.url) {
    send(res, 400, 'Bad Request');
    return;
  }

  if (req.url.startsWith('/v1/')) {
    proxyApi(req, res);
    return;
  }

  const resolvedPath = resolveStaticPath(req.url);
  if (!resolvedPath) {
    send(res, 403, 'Forbidden');
    return;
  }

  const wantsStaticFile = path.extname(resolvedPath).length > 0;
  const filePath = fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()
    ? resolvedPath
    : wantsStaticFile
      ? null
      : INDEX_FILE;

  if (!filePath) {
    send(res, 404, 'Not Found');
    return;
  }

  const stream = fs.createReadStream(filePath);
  stream.on('error', () => send(res, 500, 'Internal Server Error'));
  res.writeHead(200, {
    'Content-Type': contentTypeFor(filePath),
    'Cache-Control': filePath === INDEX_FILE ? 'no-cache' : 'public, max-age=31536000, immutable',
  });
  stream.pipe(res);
});

server.listen(PORT, HOST, () => {
  console.log(`[angular-frontline] serving ${DIST_DIR}`);
  console.log(`[angular-frontline] listening on http://${HOST}:${PORT}`);
  console.log(`[angular-frontline] proxying /v1/* -> ${API_BASE_URL}`);
});

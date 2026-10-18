import { existsSync, mkdirSync, cpSync, readdirSync, statSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';

const ROOT = process.cwd();
const OUT_DIR = resolve(ROOT, 'deploy-pages');

console.log('[prepare-pages] Assembling Cloudflare Pages deployment bundle in:', OUT_DIR);

if (!existsSync(OUT_DIR)) {
  mkdirSync(OUT_DIR, { recursive: true });
}

// 1. Copy public assets
const publicDir = resolve(ROOT, 'public');
if (existsSync(publicDir)) {
  console.log('[prepare-pages] Copying public/ -> deploy-pages/');
  cpSync(publicDir, OUT_DIR, { recursive: true });
}

// 2. Copy .next/static -> deploy-pages/_next/static
const nextStatic = resolve(ROOT, '.next/static');
const destStatic = resolve(OUT_DIR, '_next/static');
if (existsSync(nextStatic)) {
  console.log('[prepare-pages] Copying .next/static -> deploy-pages/_next/static');
  mkdirSync(destStatic, { recursive: true });
  cpSync(nextStatic, destStatic, { recursive: true });
}

// 3. Copy HTML pages from .next/server/app
const appServerDir = resolve(ROOT, '.next/server/app');
function copyHtmlFiles(dir, relativePath = '') {
  const items = readdirSync(dir);
  for (const item of items) {
    const fullPath = join(dir, item);
    const rel = join(relativePath, item);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      copyHtmlFiles(fullPath, rel);
    } else if (item.endsWith('.html')) {
      const destFile = join(OUT_DIR, rel);
      mkdirSync(dirname(destFile), { recursive: true });
      cpSync(fullPath, destFile);

      // If _not-found.html, also save as 404.html
      if (item === '_not-found.html') {
        cpSync(fullPath, join(OUT_DIR, '404.html'));
      }
    }
  }
}

if (existsSync(appServerDir)) {
  console.log('[prepare-pages] Copying pre-rendered HTML routes...');
  copyHtmlFiles(appServerDir);
}

// 4. Create Cloudflare Pages _headers
const headersContent = `/*
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
`;
writeFileSync(join(OUT_DIR, '_headers'), headersContent, 'utf-8');

// 5. Create Cloudflare Pages _redirects from content/redirects.json
const redirectsFile = resolve(ROOT, 'content/redirects.json');
let redirectsContent = '';
if (existsSync(redirectsFile)) {
  try {
    const redirects = JSON.parse(readFileSync(redirectsFile, 'utf-8'));
    if (Array.isArray(redirects)) {
      redirectsContent = redirects
        .filter(r => r && r.source && r.destination)
        .map(r => `${r.source} ${r.destination} ${r.permanent ? '301' : '302'}`)
        .join('\n') + '\n';
    }
  } catch (e) {
    console.warn('[prepare-pages] Warning parsing redirects.json:', e.message);
  }
}
writeFileSync(join(OUT_DIR, '_redirects'), redirectsContent, 'utf-8');

console.log('[prepare-pages] Bundle successfully assembled at:', OUT_DIR);

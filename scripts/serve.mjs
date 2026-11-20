// Tiny static server for local checks: node scripts/serve.mjs <dir> <port>
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = resolve(root, process.argv[2] || 'dist');
const port = Number(process.argv[3] || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
createServer(async (req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = resolve(join(dir, p.endsWith('/') ? p + 'index.html' : p));
  if (!f.startsWith(dir)) { res.writeHead(403).end(); return; }
  try {
    const b = await readFile(f);
    res.writeHead(200, { 'content-type': types[extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }).end(b);
  } catch { res.writeHead(404).end('not found'); }
}).listen(port, () => console.log('serving', dir, 'on', port));

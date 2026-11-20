// run_cmd: node dist/server.js [--port 4173] [--host 0.0.0.0]
//          node dist/server.js --export-leaderboard out.json
// Zero-dependency static server for dist/web + a local leaderboard stored on disk (Ticket-04 §3).
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { insertEntry, parseEntry, sortEntries, type Entry } from './leaderboard';

const DIST = dirname(fileURLToPath(import.meta.url));
const WEB = join(DIST, 'web');
export const boardFile = () => resolve(process.env.LEADERBOARD_FILE ?? join(DIST, '..', 'data', 'leaderboard.json'));

export function readBoard(): Entry[] {
  try {
    const raw = JSON.parse(readFileSync(boardFile(), 'utf8')) as { entries?: unknown[] };
    return sortEntries((raw.entries ?? []).map(parseEntry).filter((e): e is Entry => e !== null)).slice(0, 10);
  } catch { return []; }
}
function writeBoard(entries: Entry[]) {
  const f = boardFile();
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f + '.tmp', JSON.stringify({ entries }, null, 2) + '\n');
  renameSync(f + '.tmp', f); // atomic replace: a crash never leaves a half-written board
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.wasm': 'application/wasm',
};

/** Map a URL path to a file inside dist/web; null for malformed encoding (Codex P4 review: decode used to throw). */
export function staticPath(pathname: string): string | null {
  let dec: string;
  try { dec = decodeURIComponent(pathname); } catch { return null; }
  const rel = normalize(dec).replace(/^([/\\]|\.\.[/\\])+/, '');
  const file = join(WEB, rel || 'index.html');
  return file.startsWith(WEB + sep) ? file : null;
}

function args(argv: string[]) {
  const a: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) a[argv[i].slice(2)] = argv[i + 1]?.startsWith('--') ? '' : (argv[++i] ?? '');
  return a;
}

export function main(argv: string[]): number {
  const a = args(argv);
  if ('export-leaderboard' in a) {
    if (!a['export-leaderboard']) { process.stderr.write('error: --export-leaderboard needs an output path\n'); return 1; }
    writeFileSync(a['export-leaderboard'], JSON.stringify({ entries: readBoard() }, null, 2) + '\n');
    return 0;
  }
  const port = Number(a.port ?? process.env.PORT ?? 4173), host = a.host ?? '0.0.0.0';
  if (!existsSync(join(WEB, 'index.html'))) { process.stderr.write('error: dist/web missing, run `npm run build` first\n'); return 1; }
  createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname === '/api/leaderboard') {
      res.setHeader('content-type', 'application/json');
      if (req.method === 'GET') { res.end(JSON.stringify({ entries: readBoard() })); return; }
      if (req.method === 'POST') {
        let body = '';
        req.on('data', (c) => { body += c; if (body.length > 4096) req.destroy(); });
        req.on('end', () => {
          let e: Entry | null = null;
          try { e = parseEntry(JSON.parse(body)); } catch { /* invalid JSON */ }
          if (!e) { res.statusCode = 400; res.end('{"error":"invalid entry"}'); return; }
          const entries = insertEntry(readBoard(), e);
          writeBoard(entries);
          res.end(JSON.stringify({ entries }));
        });
        return;
      }
      res.statusCode = 405; res.end('{}'); return;
    }
    let file = staticPath(url.pathname);
    if (!file) { res.statusCode = 400; res.end(); return; }
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(WEB, 'index.html');
    res.setHeader('content-type', TYPES[extname(file)] ?? 'application/octet-stream');
    res.end(readFileSync(file));
  }).listen(port, host, () => {
    process.stdout.write(`Đảo Đèn Lồng: http://localhost:${port}/  (leaderboard: ${boardFile()})\n`);
  });
  return 0;
}

if (process.argv[1] && /server\.(js|ts)$/.test(process.argv[1])) {
  const code = main(process.argv.slice(2));
  if (code !== 0) process.exitCode = code;
}

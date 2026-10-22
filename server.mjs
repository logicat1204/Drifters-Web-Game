import http from 'node:http';
import { createReadStream } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {networkInterfaces} from 'node:os';
import {attachOnline} from './server/online.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const songsRoot = path.join(root, 'songs');
const audio = new Set(['.mp3', '.ogg', '.wav', '.m4a', '.aac', '.flac', '.opus', '.webm']);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.flac': 'audio/flac', '.opus': 'audio/ogg', '.webm': 'audio/webm', '.ico': 'image/x-icon' };
async function listSongs(dir = songsRoot) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return []; }
  const result = [];
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...await listSongs(full));
    else if (entry.isFile() && audio.has(path.extname(entry.name).toLowerCase())) {
      const relative = path.relative(songsRoot, full).split(path.sep).join('/');
      result.push({ id: relative, name: path.parse(entry.name).name, url: '/songs/' + relative.split('/').map(encodeURIComponent).join('/') });
    }
  }
  return result.sort((a, b) => a.name.localeCompare(b.name));
}
export const server = http.createServer(async (req, res) => {
  try {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if(pathname==='/api/online'){
      const port=server.address()?.port||4173,addresses=Object.values(networkInterfaces()).flat().filter(v=>v.family==='IPv4'&&!v.internal).map(v=>v.address);
      const lan=addresses.find(ip=>/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip));
      let publicUrl=null;try{const u=new URL(process.env.PUBLIC_URL);if(['http:','https:'].includes(u.protocol)&&!u.username&&!u.password)publicUrl=u.origin;}catch{}
      const json=JSON.stringify({online:true,maxPlayers:4,publicUrl,lanUrl:lan?`http://${lan}:${port}`:null});res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:json);return;
    }
    if (pathname === '/api/songs') {
      const json = JSON.stringify({ songs: await listSongs() });
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : json); return;
    }
    const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    const target = path.resolve(root, relative);
    if (!target.startsWith(root + path.sep) || relative.split(/[\\/]/).some(p => p.startsWith('.')) || !types[path.extname(target).toLowerCase()]) { res.writeHead(403).end('Forbidden'); return; }
    const info = await stat(target);
    if (!info.isFile()) { res.writeHead(404).end(); return; }
    const headers = { 'Content-Type': types[path.extname(target).toLowerCase()], 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' };
    let start = 0, end = info.size - 1, status = 200;
    if (req.headers.range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if (!match || (!match[1] && !match[2])) { res.writeHead(416, { 'Content-Range': `bytes */${info.size}` }).end(); return; }
      start = match[1] ? Number(match[1]) : Math.max(0, info.size - Number(match[2]));
      end = match[1] && match[2] ? Math.min(Number(match[2]), end) : end;
      if (start > end || start >= info.size) { res.writeHead(416, { 'Content-Range': `bytes */${info.size}` }).end(); return; }
      status = 206; headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`;
    }
    headers['Content-Length'] = Math.max(0, end - start + 1);
    res.writeHead(status, headers);
    if (req.method === 'HEAD' || info.size === 0) res.end();
    else createReadStream(target, { start, end }).on('error', () => res.destroy()).pipe(res);
  } catch { res.writeHead(404).end('Not found'); }
});
export const online=attachOnline(server);
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 4173;
  server.listen(port, process.env.HOST||'0.0.0.0', () => console.log(`\n  TOUGE / AFTER HOURS\n  Juega en http://127.0.0.1:${port}\n  Online: WebSocket /online · hasta 4 jugadores\n  Musica: ${songsRoot}\n  Ctrl+C para detener.\n`));
  server.on('error', e => { console.error(e.code === 'EADDRINUSE' ? `El puerto ${port} esta ocupado. Usa otro: $env:PORT=4174; npm start` : e.message); process.exitCode = 1; });
}

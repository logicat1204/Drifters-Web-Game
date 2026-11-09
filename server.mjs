import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {networkInterfaces} from 'node:os';
import {attachOnline} from './server/online.mjs';
import {databaseUnavailable,isMongoError,loadDatabaseEnv,openStore} from './server/database.mjs';
import {Accounts} from './server/accounts.mjs';
import {publicOrigin} from './server/origin.mjs';
import {MediaLibrary} from './server/media.mjs';
import {CosmeticPacks} from './server/cosmetic-packs.mjs';
import {installCosmetics} from './js/avatar.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
loadDatabaseEnv();
const realRoot=await realpath(root);
const songsRoot = path.join(root, 'songs');
export const cosmeticPacks=new CosmeticPacks(root);
installCosmetics(await cosmeticPacks.reload());
for(const warning of cosmeticPacks.warnings)console.warn('Paquete cosmético omitido:',warning.pack,warning.error);
export const store=await openStore();
export const media=new MediaLibrary(root);
export const accounts=new Accounts(store,{media,packs:cosmeticPacks});
let onlineService;
const types = { '.glb': 'model/gltf-binary', '.gif':'image/gif', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.flac': 'audio/flac', '.opus': 'audio/ogg', '.webm': 'audio/webm', '.ico': 'image/x-icon' };
export const server = http.createServer(async (req, res) => {
  try {
    const requestUrl=new URL(req.url,'http://localhost');
    if(await accounts.handle(req,res,requestUrl,onlineService))return;
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const ownedSong=/^\/api\/music\/(song-[a-f0-9]{24})$/.exec(pathname);
    let musicTarget=null;
    if(ownedSong){
      try{const {user}=await accounts.require(req,true);if(!user.music.includes(ownedSong[1]))throw Object.assign(Error('Compra esta canción en la tienda.'),{status:403});musicTarget=(await media.shopSongs()).find(song=>song.id===ownedSong[1])?.absolute;if(!musicTarget)throw Object.assign(Error('Canción no disponible.'),{status:404});}
      catch(error){const unavailable=isMongoError(error);res.writeHead(unavailable?503:error.status||400,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({error:unavailable?databaseUnavailable:error.message}));return;}
    }
    if(pathname==='/api/online'){
      const port=server.address()?.port||4173,addresses=Object.values(networkInterfaces()).flat().filter(v=>v.family==='IPv4'&&!v.internal).map(v=>v.address);
      const lan=addresses.find(ip=>/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip));
      const publicUrl=publicOrigin();
      const json=JSON.stringify({online:true,maxPlayers:4,publicUrl,lanUrl:lan?`http://${lan}:${port}`:null});res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:json);return;
    }
    if (pathname === '/api/songs') {
      const json = JSON.stringify({ songs: await media.freeSongs() });
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : json); return;
    }
    const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    if(!musicTarget&&!['index.html','style.css'].includes(relative)&&!['js/','assets/','songs/','campaign_files/',...(process.env.NODE_ENV==='production'?[]:['tests/'])].some(prefix=>relative.startsWith(prefix))){res.writeHead(403).end('Forbidden');return;}
    const target = musicTarget||path.resolve(root, relative);
    if(!musicTarget&&media.isShopFile(target)){res.writeHead(403).end('Compra esta canción en la tienda.');return;}
    const actualTarget=await realpath(target);
    if(!actualTarget.startsWith(realRoot+path.sep)||!musicTarget&&media.isShopFile(actualTarget)){res.writeHead(403).end('Forbidden');return;}
    if (!target.startsWith(root + path.sep) || relative.split(/[\\/]/).some(p => p.startsWith('.')) || !types[path.extname(target).toLowerCase()]) { res.writeHead(403).end('Forbidden'); return; }
    const info = await stat(target);
    if (!info.isFile()) { res.writeHead(404).end(); return; }
    const headers = { 'Content-Type': types[path.extname(target).toLowerCase()], 'Accept-Ranges': 'bytes', 'Cache-Control': musicTarget?'private, no-store':'no-cache', 'X-Content-Type-Options': 'nosniff' };
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
export const online=onlineService=attachOnline(server,{accounts,store});
if(store.remote)server.once('close',()=>void store.close());
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 4173;
  server.listen(port, process.env.HOST||'0.0.0.0', () => console.log(`\n  TOUGE / AFTER HOURS\n  Juega en http://127.0.0.1:${port}\n  Online: WebSocket /online · hasta 4 jugadores\n  Musica: ${songsRoot}\n  Ctrl+C para detener.\n`));
  server.on('error', e => { console.error(e.code === 'EADDRINUSE' ? `El puerto ${port} esta ocupado. Usa otro: $env:PORT=4174; npm start` : e.message); if(store.remote)void store.close();process.exitCode = 1; });
}

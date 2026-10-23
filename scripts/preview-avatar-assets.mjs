// Render the same embedded PNG composition served by the game, for visual review.
import {createRequire} from 'node:module';
import {mkdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {defaultAvatar,avatarOptions} from '../js/avatar.mjs';
import {avatarSvg} from '../server/store.mjs';
const require=createRequire(import.meta.url),sharp=require(process.env.SHARP_MODULE||'sharp');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=path.join(root,'screenshots');
await mkdir(out,{recursive:true});
const image=async(a,width,height)=>'data:image/png;base64,'+(await sharp(Buffer.from(avatarSvg(a))).resize(width,height).png().toBuffer()).toString('base64');
const wrap=(width,height,body)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#111a20"/><g font-family="Arial,sans-serif">${body}</g></svg>`;
let comparison='<text x="44" y="45" fill="#d4e0df" font-size="15" letter-spacing="3">TOUGE / LICENCIAS V2</text><text x="44" y="91" fill="#fff" font-size="30" font-weight="bold">Dos bases. Dos catálogos.</text>';
for(const [i,base] of ['male','female'].entries()){
  const x=44+i*418,color=i?'#8fd4c3':'#e3bc75';
  comparison+=`<rect x="${x}" y="121" width="374" height="530" rx="9" fill="#1e2d34"/><image x="${x+7}" y="128" width="360" height="450" href="${await image(defaultAvatar(base),360,450)}"/><text x="${x+20}" y="610" font-size="23" font-weight="bold" fill="${color}">${i?'MUJER':'HOMBRE'}</text><text x="${x+20}" y="634" font-size="13" fill="#b5c7c9">Rostro, silueta y piezas propios</text>`;
}
await sharp(Buffer.from(wrap(900,686,comparison))).png().toFile(path.join(out,'avatar-bases-v2.png'));
let gallery='<text x="36" y="40" fill="#fff" font-size="23" font-weight="bold">TOUGE / CATÁLOGOS DE AVATAR</text>';
for(const [row,base] of ['male','female'].entries()){
  const y=72+row*464;
  for(const [col,[hair,label]] of avatarOptions(base).hair.entries()){
    const x=24+col*308,a={...defaultAvatar(base),hair,outfit:['shirt','jacket','hoodie','jacket'][col]};
    gallery+=`<image x="${x}" y="${y}" width="284" height="355" href="${await image(a,284,355)}"/><text x="${x+10}" y="${y+388}" fill="${row?'#8fd4c3':'#e3bc75'}" font-size="15" font-weight="bold">${row?'MUJER':'HOMBRE'} / ${label}</text><text x="${x+10}" y="${y+413}" fill="#b5c7c9" font-size="13">${avatarOptions(base).outfit.find(([id])=>id===a.outfit)[1]}</text>`;
  }
}
await sharp(Buffer.from(wrap(1280,990,gallery))).png().toFile(path.join(out,'avatar-catalogos-v2.png'));
// Guard against accidentally exporting the same base geometry under two names.
const [male,female]=await Promise.all(['male','female'].map(base=>readFile(path.join(root,'assets/avatars/v2/layers',base,'base-skin.png'))));
if(male.equals(female))throw Error('Las bases deben tener dibujos independientes.');
console.log('Capturas: screenshots/avatar-bases-v2.png y avatar-catalogos-v2.png');

// Original vector artwork: two independent portrait rigs, rasterized to transparent PNG.
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {AVATAR_VERSION,COSMETICS,avatarOptions,defaultAvatar,avatarLayers} from '../js/avatar.mjs';
const require=createRequire(import.meta.url),sharp=require(process.env.SHARP_MODULE||'sharp');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../assets/avatars/v2');
await mkdir(path.join(root,'layers'),{recursive:true});await mkdir(path.join(root,'sources'),{recursive:true});
const ink='#252a32',parts={},p=(d,fill='none',stroke=ink,width=4)=>`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
for(const base of ['male']){
  const head='M162 150 Q164 99 256 96 Q348 99 350 150 L345 255 Q340 300 289 332 Q256 348 223 332 Q172 300 167 255 Z';
  parts['base-'+base+'-skin']=p('M213 312 L213 365 Q155 381 128 413 L105 640 L407 640 L384 413 Q357 381 299 365 L299 312 Z','white','none')+p(head,'white','none')+p('M167 209 Q136 194 144 239 Q149 263 170 260 M345 209 Q376 194 368 239 Q363 263 342 260','white','none');
  parts['base-'+base+'-lines']=p(head)+p('M166 212 Q144 207 151 237 M346 212 Q368 207 361 237')+p('M213 322 L213 365 Q187 375 166 387 M299 322 L299 365 Q325 375 346 387')+p('M251 239 L246 269 L261 273','none',ink,3)+p('M225 326 Q256 348 287 326','none','#633c3940',12)+p('M218 365 Q256 389 294 365','none','#633c3940',5);
}
parts['hair-short-back']=p('M151 224 Q120 178 151 112 Q170 62 256 70 Q346 66 369 124 Q389 186 359 232 L340 171 L172 171 Z','white',ink);
parts['hair-spiked-back']=p('M146 235 L122 179 L133 127 L110 103 L165 104 L167 69 L211 81 L244 42 L282 73 L320 57 L334 91 L375 84 L367 123 L395 151 L367 230 L343 171 L170 171 Z','white',ink);
parts['hair-bob-back']=p('M145 175 Q136 66 256 64 Q376 66 367 175 L384 342 Q337 375 296 343 L209 343 Q163 375 128 342 Z','white',ink);
parts['hair-long-back']=p('M143 174 Q135 61 256 62 Q377 61 369 174 L396 452 Q336 487 294 452 L217 452 Q167 480 116 448 Z','white',ink);
parts['hair-short-front']=p('M149 171 Q145 82 256 79 Q369 83 363 173 L343 236 L331 161 L294 192 L287 146 L245 190 L235 143 L194 179 L182 158 L166 238 Z','white',ink);
parts['hair-spiked-front']=p('M148 173 L154 109 L198 87 L248 76 L316 94 L360 136 L354 219 L331 161 L311 184 L290 140 L258 183 L238 137 L203 182 L188 157 L167 234 Z','white',ink);
parts['hair-bob-front']=p('M146 174 Q153 79 256 78 Q359 79 366 174 L350 297 L335 298 L329 165 L283 187 L279 154 L248 188 L237 154 L187 178 L179 298 L158 294 Z','white',ink);
parts['hair-long-front']=p('M144 175 Q151 76 256 76 Q361 76 369 175 L352 362 L331 384 L328 158 Q302 155 269 122 Q238 158 185 174 L182 373 L158 352 Z','white',ink);
for(const hair of ['short','spiked','bob','long'])parts['hair-'+hair+'-lines']=p(hair==='spiked'?'M168 135 L220 104 L243 119 M280 108 L333 137':'M173 138 Q220 94 256 103 M299 112 Q334 129 342 158','none','#ffffff44',5)+p('M183 203 L175 229 M333 203 L342 229','none',ink,3);
parts['eyes-calm']=p('M186 221 Q212 208 236 223 M276 223 Q300 208 326 221','white',ink,4)+p('M191 230 Q212 242 233 230 M279 230 Q301 242 321 230','none',ink,2)+`<ellipse cx="214" cy="224" rx="7" ry="10" fill="${ink}"/><ellipse cx="298" cy="224" rx="7" ry="10" fill="${ink}"/>`+p('M183 200 Q211 193 236 204 M276 204 Q301 193 329 200','none',ink,5);
parts['eyes-sharp']=p('M184 217 L235 227 Q209 247 189 230 Z M328 217 L277 227 Q303 247 323 230 Z','white',ink,4)+`<circle cx="215" cy="228" r="7" fill="${ink}"/><circle cx="297" cy="228" r="7" fill="${ink}"/>`+p('M184 197 L237 212 M328 197 L275 212','none',ink,6);
parts['eyes-round']=`<ellipse cx="211" cy="226" rx="23" ry="17" fill="white" stroke="${ink}" stroke-width="4"/><ellipse cx="301" cy="226" rx="23" ry="17" fill="white" stroke="${ink}" stroke-width="4"/><ellipse cx="213" cy="228" rx="9" ry="13" fill="${ink}"/><ellipse cx="299" cy="228" rx="9" ry="13" fill="${ink}"/>`+p('M187 199 Q210 191 234 201 M278 201 Q302 191 325 199','none',ink,5);
parts['mouth-neutral']=p('M235 296 Q256 299 277 296','none',ink,3)+p('M245 308 L266 308','none','#774e4566',2);
parts['mouth-smile']=p('M231 291 Q256 317 281 291 Q256 301 231 291 Z','white',ink,3);
parts['mouth-full']=p('M232 297 Q248 282 256 290 Q264 282 280 297 Q256 317 232 297 Z','#bc7a76','none')+p('M233 297 Q256 301 279 297','none',ink,2);
const torso='M210 364 Q256 393 302 364 L372 392 Q402 410 416 480 L441 640 L71 640 L96 480 Q110 410 140 392 Z';
parts['outfit-shirt-color']=p(torso,'white',ink);
parts['outfit-shirt-lines']=p('M210 364 Q256 412 302 364 M145 402 L135 640 M367 402 L377 640 M89 505 L136 516 M423 505 L376 516')+p('M171 418 L158 628 M341 418 L354 628','none','#ffffff22',18);
parts['outfit-jacket-color']=p(torso,'white',ink);
parts['outfit-jacket-lines']=p('M213 362 L181 399 L226 446 L256 397 L286 446 L331 399 L299 362','#222b33',ink)+p('M256 398 L256 640 M146 415 L132 640 M366 415 L380 640')+p('M165 490 L216 490 M296 490 L347 490','none','#c9d1cb',5)+p('M160 515 L217 515 L217 563 L158 563 Z M295 515 L352 515 L354 563 L295 563 Z');
parts['outfit-hoodie-color']=p(torso,'white',ink)+p('M211 350 Q172 353 166 394 L216 439 L256 397 L296 439 L346 394 Q340 353 301 350 Q256 377 211 350 Z','white',ink);
parts['outfit-hoodie-lines']=p('M210 369 L221 449 M302 369 L291 449 M145 415 L132 640 M367 415 L380 640 M190 550 L174 600 L338 600 L322 550 Z')+p('M221 441 L221 468 M291 441 L291 468','none','#e3e1cc',5);
parts['accessory-glasses']=`<rect x="177" y="210" width="66" height="40" rx="12" fill="#8bbec31a" stroke="${ink}" stroke-width="6"/><rect x="269" y="210" width="66" height="40" rx="12" fill="#8bbec31a" stroke="${ink}" stroke-width="6"/>`+p('M243 223 Q256 215 269 223 M177 221 L160 214 M335 221 L352 214');
parts['accessory-earrings']=`<circle cx="158" cy="259" r="11" fill="none" stroke="#e0ba6c" stroke-width="6"/><circle cx="354" cy="259" r="11" fill="none" stroke="#e0ba6c" stroke-width="6"/>`;
parts['accessory-cap']=p('M146 153 Q151 65 256 64 Q361 65 366 153 L258 169 Z','#344750',ink)+p('M152 150 Q256 130 366 150 L390 182 Q305 196 249 170 L146 164 Z','#263840',ink)+p('M256 74 L256 137','none','#8b9ba0',3)+p('M237 104 L274 104 L248 130 L237 130 L257 113 L237 113 Z','#e0dfd4','none');
for(const hair of ['short','spiked','bob','long'])parts['hair-'+hair+'-lines']=parts['hair-'+hair+'-front'].replaceAll('fill="white"','fill="none"')+parts['hair-'+hair+'-lines'];
for(const outfit of ['shirt','jacket','hoodie'])parts['outfit-'+outfit+'-lines']=parts['outfit-'+outfit+'-color'].replaceAll('fill="white"','fill="none"')+parts['outfit-'+outfit+'-lines'];
// Preserve the established male drawing, with its own paths and inventory namespace.
for(const [id,body] of Object.entries({...parts})){
  delete parts[id];
  if(id==='accessory-earrings')continue;
  const key=id.replace('base-male-','base-').replaceAll('hair-bob-','hair-swept-');
  parts['male/'+key]=body;
}
parts['male/accessory-stud']=`<circle cx="157" cy="251" r="6" fill="#cbd5df" stroke="${ink}" stroke-width="2"/>`;

// Female rig: oval face, tapered chin, narrower neck, sloping shoulders and tailored clothing.
const f=(id,body)=>{parts['female/'+id]=body;};
const face='M176 158 Q174 105 254 102 Q335 102 336 157 L331 239 Q326 278 302 300 Q278 325 256 333 Q234 327 210 304 Q182 280 179 242 Z';
f('base-skin',p('M229 314 L229 366 Q219 381 192 388 L176 404 L174 640 L338 640 L336 404 L320 388 Q293 381 283 366 L283 314 Z','white','none')+p('M181 211 Q157 202 160 228 Q162 251 183 253 M331 211 Q355 202 352 228 Q350 251 329 253','white','none')+p(face,'white','none'));
f('base-lines',p(face,'none',ink,3)+p('M178 217 Q164 214 169 232 M334 217 Q348 214 343 232','none',ink,2)+p('M229 323 L229 365 Q222 379 206 383 M283 323 L283 365 Q290 379 306 383','none',ink,3)+p('M251 243 Q248 258 245 265 L256 269','none','#88604d',2)+p('M233 320 Q256 341 279 320','none','#633c392c',9)+p('M221 384 L240 391 M272 391 L291 384','none','#633c3944',3));

f('hair-bob-back',p('M151 181 Q142 76 250 70 Q359 63 364 171 L376 334 Q345 367 304 348 L208 348 Q168 368 137 335 Z','white',ink,3));
f('hair-bob-front',p('M151 184 Q144 88 247 79 Q350 73 359 171 L351 310 L325 330 L321 204 Q298 182 286 139 Q246 177 187 190 L187 307 L159 325 Z','white',ink,3));
f('hair-bob-lines',p('M167 172 Q195 108 260 96 M185 187 Q235 168 268 134 M328 182 L337 299 M165 214 L170 300','none','#ffffff39',3));
f('hair-long-back',p('M150 170 Q150 70 252 67 Q359 67 362 174 L381 401 Q391 449 375 489 L329 471 L312 493 L202 491 L179 471 L128 491 Q115 449 132 402 Z','white',ink,3));
f('hair-long-front',p('M151 181 Q148 81 251 77 Q356 75 362 174 L351 370 Q344 407 320 430 L326 240 Q327 178 283 133 Q251 171 188 186 L189 360 L175 421 Q151 385 152 329 Z','white',ink,3));
f('hair-long-lines',p('M170 154 Q197 102 249 96 M287 103 Q339 148 340 209 M166 222 Q177 345 162 373 M340 245 L334 389','none','#ffffff35',3));
f('hair-ponytail-back',p('M285 105 Q328 36 372 89 Q409 138 384 202 Q361 277 393 325 Q362 324 342 289 Q321 250 337 188 Q349 143 316 137 Z','white',ink,3)+p('M151 187 Q137 76 250 72 Q359 66 359 179 L333 228 L182 228 Z','white',ink,3));
f('hair-ponytail-front',p('M152 180 Q148 84 251 81 Q351 77 359 178 L338 233 L324 179 Q287 167 276 132 Q242 177 190 183 L177 236 Z','white',ink,3));
f('hair-ponytail-lines',p('M172 152 Q209 107 258 100 M293 108 Q333 134 339 161 M347 105 Q379 115 368 170 M354 210 Q347 261 369 294','none','#ffffff40',4)+p('M330 104 L344 116','none','#bc796e',9));
f('hair-wavy-back',p('M149 171 Q139 68 249 68 Q362 61 364 173 Q393 208 372 252 Q400 282 375 321 Q404 356 375 393 Q400 431 367 462 L307 444 L205 444 L143 465 Q111 438 136 401 Q111 367 135 330 Q110 294 135 257 Q115 215 149 171 Z','white',ink,3));
f('hair-wavy-front',p('M150 181 Q143 83 247 78 Q356 74 361 174 Q346 201 350 243 Q377 280 350 319 Q374 360 346 402 L318 414 Q336 379 319 343 Q309 311 328 277 Q307 232 322 191 Q295 170 282 137 Q244 181 191 186 Q174 220 187 254 Q204 289 184 321 Q199 358 178 400 L149 418 Q169 378 146 342 Q129 313 151 281 Q134 244 150 181 Z','white',ink,3));
f('hair-wavy-lines',p('M165 158 Q199 104 254 96 M299 115 Q328 143 335 169 M165 216 Q153 248 171 283 Q151 318 166 349 M340 220 Q330 251 345 279 Q330 306 341 332','none','#ffffff3b',3));

const iris=(cx,cy,rx=7,ry=10)=>`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#4b515d"/><ellipse cx="${cx}" cy="${cy+1}" rx="3.5" ry="${ry-2}" fill="${ink}"/><circle cx="${cx-2}" cy="${cy-4}" r="2.4" fill="#fff"/>`;
f('eyes-almond',p('M191 221 Q212 201 235 221 Q213 237 191 221 Z M277 221 Q300 201 321 221 Q299 237 277 221 Z','#faf7ef',ink,2)+iris(215,220)+iris(297,220)+p('M191 221 Q211 201 235 221 M277 221 Q301 201 321 221','none',ink,4)+p('M191 220 L186 214 M321 220 L326 214','none',ink,2.5)+p('M193 197 Q214 188 233 199 M279 199 Q300 188 319 197','none',ink,3));
f('eyes-defined',p('M190 216 L235 225 Q214 238 193 226 Z M322 216 L277 225 Q298 238 319 226 Z','#faf7ef',ink,2)+iris(215,224,7,8)+iris(297,224,7,8)+p('M190 216 L235 225 M322 216 L277 225','none',ink,4)+p('M190 217 L185 211 M322 217 L327 211','none',ink,3)+p('M193 194 L234 204 M319 194 L278 204','none',ink,3));
f('eyes-soft',p('M192 221 Q195 202 214 203 Q232 203 235 221 Q217 242 192 221 Z M277 221 Q280 203 298 203 Q317 202 320 221 Q295 242 277 221 Z','#faf7ef',ink,2)+iris(215,220,8,12)+iris(297,220,8,12)+p('M192 221 Q195 202 214 203 Q232 203 235 221 M277 221 Q280 203 298 203 Q317 202 320 221','none',ink,3.5)+p('M192 218 L188 212 M320 218 L324 212','none',ink,2)+p('M193 191 Q214 185 232 194 M280 194 Q298 185 319 191','none',ink,3));
f('mouth-natural',p('M238 291 Q249 284 256 289 Q263 284 274 291 Q256 304 238 291 Z','#b87973','none')+p('M239 291 Q256 294 273 291','none','#704d4c',1.8)+p('M248 299 L263 299','none','#e3b2a2',1.5));
f('mouth-smile',p('M235 286 Q256 305 277 286 Q256 317 235 286 Z','#b87973','none')+p('M238 288 Q256 299 274 288 Q256 304 238 288 Z','#fff6e8','#704d4c',1.5));
f('mouth-defined',p('M235 291 Q248 280 256 287 Q264 280 277 291 Q256 312 235 291 Z','#ad626c','none')+p('M237 291 Q256 296 275 291','none','#70454b',2)+p('M248 301 L264 301','none','#eab0ae',2));

const femaleShirt='M226 372 Q256 391 286 372 L336 394 Q358 402 369 447 L388 640 L124 640 L143 447 Q154 402 176 394 Z';
const femaleJacket='M226 372 L209 383 L173 393 Q149 407 145 454 L139 521 L157 574 L148 640 L364 640 L355 574 L373 521 L367 454 Q363 407 339 393 L303 383 L286 372 Z';
const femaleHoodie='M223 365 Q256 387 289 365 L346 394 Q374 417 379 461 L397 640 L115 640 L133 461 Q138 417 166 394 Z';
f('outfit-shirt-color',p(femaleShirt,'white',ink,3));
f('outfit-shirt-lines',p('M226 373 Q256 419 286 373 M175 406 L166 479 L174 559 L161 640 M337 406 L346 479 L338 559 L351 640 M137 495 L167 501 M375 495 L345 501','none',ink,3)+p('M190 432 L184 477 M322 432 L328 477','none','#ffffff30',10));
f('outfit-jacket-color',p(femaleJacket,'white',ink,3));
f('outfit-jacket-lines',p('M226 372 Q256 389 286 372 L277 437 L235 437 Z','#e0dfd4',ink,2)+p('M225 370 L204 384 L192 418 L229 449 L241 403 Z M287 370 L308 384 L320 418 L283 449 L271 403 Z','#25333d',ink,3)+p('M256 438 L256 640 M175 422 L169 493 L184 558 L174 640 M337 422 L343 493 L328 558 L338 640 M183 493 L220 486 M292 486 L329 493','none',ink,3)+p('M184 491 L220 484 M292 484 L328 491','none','#b9c8c9',3)+p('M157 582 Q256 601 355 582','none',ink,4));
f('outfit-hoodie-color',p(femaleHoodie,'white',ink,3)+p('M224 354 Q190 354 182 388 L217 431 L256 399 L295 431 L330 388 Q322 354 288 354 Q256 375 224 354 Z','white',ink,3));
f('outfit-hoodie-lines',p('M224 373 L232 432 M288 373 L280 432 M169 423 L159 508 L171 575 M343 423 L353 508 L341 575 M206 548 L190 588 Q256 601 322 588 L306 548 Z M126 621 Q256 641 386 621','none',ink,3)+p('M232 425 L232 463 M280 425 L280 463','none','#e6dfcd',4));
f('accessory-glasses',p('M185 215 Q207 203 238 215 L235 237 Q211 250 191 234 Z M274 215 Q305 203 327 215 L321 234 Q301 250 277 237 Z','#8bbec31a','#835c51',4)+p('M238 219 Q256 211 274 219 M185 219 L172 213 M327 219 L340 213','none','#835c51',3));
f('accessory-earrings',`<ellipse cx="174" cy="255" rx="8" ry="14" fill="none" stroke="#e0ba6c" stroke-width="4"/><ellipse cx="338" cy="255" rx="8" ry="14" fill="none" stroke="#e0ba6c" stroke-width="4"/>`);
f('accessory-headband',p('M151 174 Q147 83 246 77 Q347 73 359 164 L351 173 Q338 91 247 94 Q163 100 162 179 Z','#a94649',ink,2)+p('M318 91 L346 73 L348 98 L372 98 L353 117 Z','#b65c60',ink,2));

// Color masks carry alpha only. Ink/details remain above them after server tinting.
for(const base of ['male','female']){
  for(const [hair] of avatarOptions(base).hair){
    const id=base+'/hair-'+hair;
    if(base==='female')parts[id+'-lines']=parts[id+'-front'].replaceAll('fill="white"','fill="none"')+parts[id+'-lines'];
  }
  for(const [outfit] of avatarOptions(base).outfit){
    const id=base+'/outfit-'+outfit;
    if(base==='female')parts[id+'-lines']=parts[id+'-color'].replaceAll('fill="white"','fill="none"')+parts[id+'-lines'];
  }
}
const wrap=body=>`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="640" viewBox="0 0 512 640">${body}</svg>`;
for(const base of ['male','female'])for(const folder of ['sources','layers'])await mkdir(path.join(root,folder,base),{recursive:true});
for(const [id,body] of Object.entries(parts)){
  const svg=wrap(body);await writeFile(path.join(root,'sources',id+'.svg'),svg);
  // Match the runtime: tintable layers must not tint their outline a second time.
  const mask=/(?:-skin|-back|-front|-color)$/.test(id)?wrap(body.replace(/stroke="[^"]+"/g,'stroke="none"')):svg;
  await sharp(Buffer.from(mask)).png().toFile(path.join(root,'layers',id+'.png'));
}
for(const base of ['male','female']){
  const a=defaultAvatar(base),body=avatarLayers(a).map(layer=>{
    let svg=parts[layer.id];if(layer.tint)svg=svg.replaceAll('fill="white"',`fill="${layer.tint}"`).replace(/stroke="[^"]+"/g,'stroke="none"');return svg;
  }).join('');await sharp(Buffer.from(wrap(body))).png().toFile(path.join(root,'base-'+base+'.png'));
}
await writeFile(path.join(root,'catalog.json'),JSON.stringify({version:AVATAR_VERSION,canvas:{width:512,height:640},rigs:{male:{id:'portrait-v2-male',face:[256,224],neck:[256,365],shoulders:[[140,392],[372,392]]},female:{id:'portrait-v2-female',face:[256,220],neck:[256,373],shoulders:[[176,394],[336,394]]}},items:COSMETICS,options:{male:avatarOptions('male'),female:avatarOptions('female')}},null,2)+'\n');
console.log('Avatar v2: '+Object.keys(parts).length+' capas PNG/SVG en dos catálogos independientes.');

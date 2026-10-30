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
f('base-skin',p('M229 314 L229 366 Q219 381 192 388 Q175 389 166 411 L146 523 L154 640 L182 640 L184 527 L203 465 L205 515 Q218 552 207 598 L202 640 L310 640 L305 598 Q294 552 307 515 L309 465 L328 527 L330 640 L358 640 L366 523 L346 411 Q337 389 320 388 Q293 381 283 366 L283 314 Z','white','none')+p('M181 211 Q157 202 160 228 Q162 251 183 253 M331 211 Q355 202 352 228 Q350 251 329 253','white','none')+p(face,'white','none'));
f('base-lines',p(face,'none',ink,3)+p('M178 217 Q164 214 169 232 M334 217 Q348 214 343 232','none',ink,2)+p('M229 323 L229 365 Q222 379 206 383 M283 323 L283 365 Q290 379 306 383','none',ink,3)+p('M251 243 Q248 258 245 265 L256 269','none','#88604d',2)+p('M233 320 Q256 341 279 320','none','#633c392c',9)+p('M221 384 L240 391 M272 391 L291 384','none','#633c3944',3));
parts['female/base-lines']+=p('M192 388 Q175 389 166 411 L146 523 L154 640 M320 388 Q337 389 346 411 L366 523 L358 640 M203 465 L205 515 Q218 552 207 598 M309 465 L307 515 Q294 552 305 598','none','#75544088',2)+p('M251 563 Q256 566 261 563','none','#75544088',2);

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

// Shop pieces are authored independently for each rig. No raster layer is shared.
const cloth=(base,id,shape,details)=>{parts[base+'/outfit-'+id+'-color']=p(shape,'white',ink,3);parts[base+'/outfit-'+id+'-lines']=p(shape)+details;};
const badge=(x,y,label,color='#dfdfd6')=>`<rect x="${x}" y="${y}" width="43" height="20" rx="2" fill="${color}"/><text x="${x+21.5}" y="${y+14}" text-anchor="middle" font-size="11" font-family="sans-serif" font-weight="bold" fill="#202b34">${label}</text>`;
for(const base of ['male','female']){
 const male=base==='male',shape=male?torso:femaleHoodie,left=male?156:187,right=male?313:288;
 cloth(base,'racer',shape,p(male?'M213 364 L225 397 L287 397 L299 364 M256 398 L256 640 M145 412 L134 640 M367 412 L378 640':'M224 365 L235 399 L277 399 L288 365 M256 399 L256 640 M170 419 L165 640 M342 419 L347 640')+p(`M${left} 406 L${left} 640 M${right} 406 L${right} 640`,'none','#ecebe2',15)+badge(left+16,460,'峠')+badge(right-28,510,'86'));
 for(const [key,color]of [['blue','#5c9bd5'],['red',male?'#b64f4a':'#d28fa4'],['gold','#d6b36d']])parts[base+'/accessory-glasses-'+key]=parts[base+'/accessory-glasses'].replaceAll(male?ink:'#835c51',color);
 const from=male?'short':'bob';
 for(const suffix of ['back','front','lines'])parts[base+'/hair-racer-cap-'+suffix]=parts[base+'/hair-'+from+'-'+suffix];
 parts[base+'/hair-racer-cap-lines']+=p(male?'M149 151 Q153 67 256 67 Q358 67 363 151 Z':'M152 155 Q158 79 250 76 Q343 76 357 153 Z','#273c53',ink,3)+p(male?'M149 148 Q255 130 365 148 L389 178 Q308 192 253 166 L149 162 Z':'M153 151 Q251 132 357 151 L377 177 Q303 187 250 168 L153 164 Z','#354e68',ink,3)+badge(234,113,'峠');
}
cloth('male','f1',torso,p('M213 364 L222 398 L290 398 L299 364','#ebe9df',ink)+p('M256 399 L256 640 M142 415 L128 640 M370 415 L384 640')+p('M155 398 L170 461 M357 398 L342 461','none','#efe7dc',23)+badge(179,468,'F1')+badge(291,468,'RACE')+p('M166 555 L346 555','none','#efe7dc',16)+p('M188 584 L324 584','none','#b8bdc5',5));
cloth('male','rally',torso,p('M210 364 L185 407 L226 449 L256 402 L286 449 L327 407 L302 364','#2e353e',ink)+p('M256 404 L256 640 M149 489 L213 489 L213 552 L149 552 Z M299 489 L363 489 L363 552 L299 552 Z')+p('M106 449 L143 465 M406 449 L369 465','none','#e3c963',14)+badge(179,454,'RALLY')+badge(290,454,'4WD'));
cloth('male','champion',torso,p('M213 364 L180 410 L226 459 L256 397 L286 459 L332 410 L299 364','#171c28',ink)+p('M256 401 L256 640 M144 418 L128 640 M368 418 L384 640','none','#c7af6c',4)+p('M171 502 L218 490 M294 490 L341 502','none','#c7af6c',5)+badge(179,454,'01','#c7af6c'));
const dress='M225 374 Q256 398 287 374 L327 394 L339 460 L317 529 L361 640 L151 640 L195 529 L173 460 L185 394 Z';
cloth('female','dress',dress,p('M225 374 Q256 432 287 374 M195 529 Q256 546 317 529','none',ink,3)+p('M211 550 L188 640 M301 550 L324 640','none','#ffffff44',3)+`<circle cx="256" cy="405" r="5" fill="#e2c57c"/>`);
cloth('female','sundress',dress,p('M225 374 Q256 412 287 374 M196 526 L317 526','none','#f1e4c8',9)+p('M212 549 L190 640 M237 549 L229 640 M275 549 L283 640 M301 549 L324 640','none','#ffffff50',5)+`<g fill="#e4d8ba"><circle cx="211" cy="459" r="7"/><circle cx="302" cy="484" r="7"/><circle cx="241" cy="581" r="7"/><circle cx="327" cy="618" r="7"/></g>`);
// Adult fashion portrait: an opaque athletic swim top, with the established skin rig underneath.
const swim='M185 391 L201 393 L214 447 Q232 459 256 445 Q280 459 298 447 L311 393 L327 391 L311 472 Q286 501 256 478 Q226 501 201 472 Z';
cloth('female','bikini',swim,p('M201 393 L217 447 M311 393 L295 447 M211 472 Q230 482 253 462 M259 462 Q282 482 301 472','none','#d5e9ef',4));
cloth('female','sapphire',dress,p('M225 374 L239 409 L256 425 L273 409 L287 374 M195 529 Q256 550 317 529','none','#e6c67e',5)+p('M211 553 L184 640 M301 553 L328 640','none','#ffffff44',3)+`<path d="M256 417l7 12-7 12-7-12z" fill="#8fe6ee" stroke="#e6c67e" stroke-width="2"/>`);
const addHair=(base,id,back,front,detail)=>{parts[base+'/hair-'+id+'-back']=back;parts[base+'/hair-'+id+'-front']=front;parts[base+'/hair-'+id+'-lines']=front.replaceAll('fill="white"','fill="none"')+detail;};
addHair('male','undercut',parts['male/hair-short-back'],p('M153 162 Q145 84 254 77 Q360 79 360 167 L340 211 L332 155 L305 175 L290 140 L242 182 L235 142 L179 185 L170 211 Z','white',ink),p('M177 141 Q219 103 262 99 M342 177 L344 202 M169 180 L166 203','none','#ffffff44',4));
addHair('male','braids',parts['male/hair-long-back'],p('M151 173 Q149 82 256 77 Q362 79 361 173 L345 235 L332 165 Q257 142 180 165 L166 235 Z','white',ink),p('M177 151 Q206 104 235 91 M204 155 Q232 106 256 87 M236 150 Q263 109 275 93 M277 150 Q289 113 296 100 M313 155 Q314 126 314 117','none','#ffffff55',4));
addHair('female','pixie',parts['female/hair-ponytail-back'].split(' Z')[1]?p('M156 180 Q148 80 251 77 Q353 75 357 176 L335 230 L179 230 Z','white',ink):'',p('M157 179 Q154 84 251 81 Q350 78 357 178 L338 228 L327 172 L297 188 L284 142 Q243 183 186 185 L177 231 Z','white',ink,3),p('M173 150 Q213 103 262 96','none','#ffffff44',3));
addHair('female','twinbun',p('M155 178 Q148 80 251 77 Q351 77 357 178 L332 234 L181 234 Z','white',ink,3)+`<circle cx="155" cy="115" r="39" fill="white" stroke="${ink}" stroke-width="3"/><circle cx="353" cy="115" r="39" fill="white" stroke="${ink}" stroke-width="3"/>`,parts['female/hair-ponytail-front'],p('M137 103 Q153 87 171 106 M335 103 Q351 87 369 106','none','#ffffff44',3));
addHair('female','silk',p('M146 177 Q141 66 251 66 Q364 65 367 177 L382 516 L333 498 L311 520 L200 520 L177 498 L127 516 Z','white',ink,3),parts['female/hair-long-front'],p('M164 172 Q207 98 259 93 M167 259 L158 482 M349 259 L357 482','none','#ffffff55',4)+`<path d="M325 156l7 10 11-1-8 8 3 11-10-6-10 5 3-11-8-8 11 1z" fill="#d8c387"/>`);
parts['male/eyes-focused']=parts['male/eyes-sharp']+p('M191 244 Q213 252 233 244 M279 244 Q299 252 321 244','none','#9e7965',2);
parts['male/eyes-bright']=parts['male/eyes-round'].replaceAll('fill="'+ink+'"','fill="#5b8091"')+`<circle cx="210" cy="223" r="3" fill="white"/><circle cx="296" cy="223" r="3" fill="white"/>`;
parts['female/eyes-cat']=parts['female/eyes-defined']+p('M189 216 L182 207 L195 217 M323 216 L330 207 L317 217','none','#4a3448',4);
parts['female/eyes-starlight']=parts['female/eyes-soft']+`<g fill="#d8effa"><circle cx="212" cy="219" r="3"/><circle cx="294" cy="219" r="3"/><circle cx="219" cy="227" r="2"/><circle cx="301" cy="227" r="2"/></g>`;
parts['male/makeup-warpaint']=p('M180 255 L215 264 M298 264 L333 255','none','#4b6676aa',7);
parts['female/makeup-blush']=`<ellipse cx="206" cy="259" rx="16" ry="6" fill="#c16b7755"/><ellipse cx="306" cy="259" rx="16" ry="6" fill="#c16b7755"/>`;
parts['female/makeup-eyeliner']=p('M190 220 Q212 201 236 221 M276 221 Q300 201 322 220 M190 220 L183 214 M322 220 L329 214','none','#493344',3);
parts['female/makeup-gloss']=p('M237 292 Q256 303 275 292','none','#b45878',3)+p('M248 297 L262 297','none','#fff4ee',2);

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

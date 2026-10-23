// Each base owns its geometry, catalog and inventory IDs. Only color palettes are shared.
export const AVATAR_VERSION=2;
export const AVATAR_CATALOGS={
  male:{
    hair:[['short','Corto'],['spiked','Puntas'],['swept','Flequillo recto'],['long','Largo']],
    eyes:[['calm','Serenos'],['sharp','Intensos'],['round','Abiertos']],
    mouth:[['neutral','Natural'],['smile','Sonrisa'],['full','Labios definidos']],
    outfit:[['shirt','Camiseta recta'],['jacket','Chaqueta de piloto'],['hoodie','Chompa amplia']],
    accessory:[['none','Sin accesorio'],['glasses','Gafas rectangulares'],['stud','Pendiente metálico'],['cap','Gorra']]
  },
  female:{
    hair:[['bob','Media melena'],['long','Largo en capas'],['ponytail','Cola alta'],['wavy','Ondulado']],
    eyes:[['almond','Almendrados'],['defined','Mirada intensa'],['soft','Mirada abierta']],
    mouth:[['natural','Natural'],['smile','Sonrisa suave'],['defined','Labios definidos']],
    outfit:[['shirt','Camiseta entallada'],['jacket','Cazadora corta'],['hoodie','Chompa con cordones']],
    accessory:[['none','Sin accesorio'],['glasses','Gafas redondeadas'],['earrings','Aros dorados'],['headband','Diadema']]
  }
};
const palettes={
  base:[['male','Hombre'],['female','Mujer']],
  skin:[['#f0d1b0','Claro'],['#dcb28c','Cálido'],['#c18e68','Medio'],['#a66e4f','Bronce'],['#805039','Oscuro'],['#57382e','Profundo']],
  hairColor:[['#242730','Negro'],['#543a30','Castaño'],['#9b653e','Cobrizo'],['#d6b76c','Rubio'],['#afb9c4','Plata']],
  outfitColor:[['#e0dfd4','Marfil'],['#344750','Azul noche'],['#b14d3c','Rojo'],['#69816c','Verde'],['#514658','Violeta']]
};
export function avatarOptions(base='male'){
  const c=AVATAR_CATALOGS[base];if(!c)throw Error('Base de avatar inválida.');
  return {base:palettes.base,skin:palettes.skin,hair:c.hair,hairColor:palettes.hairColor,eyes:c.eyes,mouth:c.mouth,outfit:c.outfit,outfitColor:palettes.outfitColor,accessory:c.accessory};
}
export const AVATAR_OPTIONS=avatarOptions();
export function defaultAvatar(base='male'){
  if(!AVATAR_CATALOGS[base])throw Error('Base de avatar inválida.');
  return {version:AVATAR_VERSION,base,skin:'#dcb28c',hair:base==='male'?'short':'bob',hairColor:'#242730',eyes:base==='male'?'calm':'almond',mouth:base==='male'?'neutral':'natural',outfit:'jacket',outfitColor:'#344750',accessory:'none'};
}
export const DEFAULT_AVATAR=defaultAvatar();
export function validateAvatar(value){
  if(!value||typeof value!=='object'||Array.isArray(value)||value.version!==AVATAR_VERSION)throw Error('Versión de avatar inválida.');
  const result={version:AVATAR_VERSION};
  for(const [key,items] of Object.entries(avatarOptions(value.base))){
    if(!items.some(([id])=>id===value[key]))throw Error('Elige una opción válida para '+key+'.');
    result[key]=value[key];
  }
  return result;
}
export const cosmeticId=(base,slot,key)=>`${base}.${slot}.${key}`;
export const COSMETICS=Object.entries(AVATAR_CATALOGS).flatMap(([base,slots])=>Object.entries(slots).flatMap(([slot,items])=>items.map(([key,name])=>({id:cosmeticId(base,slot,key),slot,key,name,starter:true,bases:[base],rig:`portrait-v2-${base}`}))));
export function migrateAvatar(value){
  if(value.version===AVATAR_VERSION)return validateAvatar(value);
  if(value.version!==1)throw Error('Versión de avatar inválida.');
  const a={...value,version:AVATAR_VERSION};
  if(a.base==='female'){
    a.hair=({short:'bob',spiked:'ponytail',bob:'bob',long:'long'})[a.hair];
    a.eyes=({calm:'almond',sharp:'defined',round:'soft'})[a.eyes];
    a.mouth=({neutral:'natural',smile:'smile',full:'defined'})[a.mouth];
    if(a.accessory==='cap')a.accessory='headband';
  }else{
    if(a.hair==='bob')a.hair='swept';
    if(a.accessory==='earrings')a.accessory='stud';
  }
  return validateAvatar(a);
}
export function avatarLayers(value){
  const a=validateAvatar(value),layer=(id,tint)=>({id:a.base+'/'+id,...(tint?{tint}:{})});
  return [layer('hair-'+a.hair+'-back',a.hairColor),layer('base-skin',a.skin),layer('base-lines'),
    layer('outfit-'+a.outfit+'-color',a.outfitColor),layer('outfit-'+a.outfit+'-lines'),
    layer('eyes-'+a.eyes),layer('mouth-'+a.mouth),layer('hair-'+a.hair+'-front',a.hairColor),layer('hair-'+a.hair+'-lines'),
    ...(a.accessory==='none'?[]:[layer('accessory-'+a.accessory)])];
}

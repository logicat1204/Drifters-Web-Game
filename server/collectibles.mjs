import {readFile,readdir,stat} from 'node:fs/promises';
import {randomInt} from 'node:crypto';

const root=new URL('../assets/cards/',import.meta.url);
const weights={common:62,rare:26,special:10,legendary:2};
export const cardChest={price:750,count:3};

export async function cardCatalog(){
  const entries=await readdir(root,{withFileTypes:true});
  const cards=await Promise.all(entries.filter(entry=>entry.isFile()&&/^\d{3,8}\.json$/.test(entry.name)).map(async entry=>{
    try{
      const {id,title,tier,description,image}=JSON.parse(await readFile(new URL(entry.name,root),'utf8'));
      if(id!==entry.name.slice(0,-5)||!Object.hasOwn(weights,tier)||typeof title!=='string'||!title.trim()||title.length>80||
        typeof description!=='string'||!description.trim()||description.length>2400||
        typeof image!=='string'||!/^\d{3,8}\.(webp|png|jpe?g)$/.test(image)||!(await stat(new URL(image,root))).isFile())return null;
      return {id,title,tier,description,image:'/assets/cards/'+image};
    }catch(error){if(error instanceof SyntaxError||error instanceof TypeError||error.code==='ENOENT')return null;throw error;}
  }));
  return cards.filter(Boolean).sort((a,b)=>a.id.localeCompare(b.id,'en',{numeric:true}));
}

export function openCardChest(catalog){
  if(!catalog.length)throw Object.assign(Error('No hay cartas disponibles.'),{status:409});
  const tiers=Object.entries(weights).map(([tier,weight])=>({pool:catalog.filter(card=>card.tier===tier),weight})).filter(tier=>tier.pool.length);
  const total=tiers.reduce((sum,tier)=>sum+tier.weight,0);
  return Array.from({length:cardChest.count},()=>{
    let roll=randomInt(total);
    const {pool}=tiers.find(({weight})=>(roll-=weight)<0);
    return pool[randomInt(pool.length)].id;
  });
}

export function cardReceipt(id){
  if(typeof id!=='string'||!/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/.test(id))throw Error('Identificador de cofre inválido.');
  return id;
}

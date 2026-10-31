// Boss rules are deterministic simulation state. Rendering consumes them without
// deciding passes, rewards, speed, or race results.
export const BOSS_TRAITS={
  'shinji-campaign':{name:'Línea de luz',color:'#d9f3ff',description:'Un rayo de luz marca cada curva que completa limpiamente.'},
  'takumi-project':{name:'Alas de la montaña',color:'#b8f0ff',description:'Se desdibuja en curvas al límite. Sus alas aparecen cuando te adelanta.'},
  'keisuke-project':{name:'Flujo rotativo',color:'#ffe282',description:'Una curva fluida a velocidad sostenida enciende su aura azul y dorada.'},
  beckenbauer:{name:'Disciplina divina',color:'#fff3c1',description:'Un halo blanco y dorado acompaña permanentemente su trazada.'},
  'kanata-final':{name:'Despertar carmesí',color:'#ff5269',description:'Al adelantarlo despiertas su contraataque. Su aura y su impulso se apagan un segundo después de que recupere la posición.'}
};
export const KANATA_COUNTER=Object.freeze({windup:.65,duration:7,cooldown:9,leadGrace:1,topSpeed:1.12,acceleration:1.70,grip:1.06,braking:1.10,passDistance:4});
export function createBossState(rival){
  const id=rival?.boss||rival?.id;if(!BOSS_TRAITS[id])return null;
  return {id,ray:0,blur:0,wings:0,flow:0,enraged:false,leadTime:0,windup:0,boost:0,cooldown:0,boostCount:0,confirmedSide:0,awardId:0,inCorner:false,cornerSign:0,cornerStart:0,quiet:0,steady:0,flowCooldown:0,lastSpeed:0,eventId:0,message:''};
}
export function updateBossState(r,dt,curve){
  const b=r.boss,o=r.opponent;if(!b||!o)return;
  const emit=message=>{b.message=message;b.eventId++;};
  for(const key of ['ray','wings','flow','boost','cooldown','flowCooldown'])b[key]=Math.max(0,b[key]-dt);
  if(b.windup>0){b.windup=Math.max(0,b.windup-dt);if(b.windup===0)b.boost=KANATA_COUNTER.duration;}
  const gap=r.s-o.s,side=gap>=KANATA_COUNTER.passDistance?1:gap<=-KANATA_COUNTER.passDistance?-1:0;
  // Recovery cannot manufacture an overtake. The ±4 m deadband also prevents
  // contact jitter or nose-to-nose oscillation from repeatedly retriggering it.
  if(b.confirmedSide===0||r.resetHold>0||o.resetHold>0){if(side)b.confirmedSide=side;}
  else if(side&&side!==b.confirmedSide){
    const previous=b.confirmedSide;b.confirmedSide=side;
    if(b.id==='takumi-project'&&previous===1&&side===-1){b.wings=1.7;emit('TAKUMI D / ALAS DE LA MONTAÑA');}
    if(b.id==='kanata-final'&&previous===-1&&side===1){
      b.enraged=true;
      if(b.cooldown===0&&b.windup===0&&b.boost===0){b.windup=KANATA_COUNTER.windup;b.cooldown=KANATA_COUNTER.cooldown;b.boostCount++;emit('KANATA / DESPERTAR CARMESÍ · CONTRAATAQUE');}
    }
  }
  if(b.id==='kanata-final'){
    // Only a real pass awakens him. A brief lead starts a continuous one-second
    // grace period; falling behind again cancels that timer instead of adding it up.
    b.leadTime=b.enraged&&gap<0?b.leadTime+dt:0;
    if(b.enraged&&(b.leadTime>=KANATA_COUNTER.leadGrace-1e-9||(o.finished&&gap<0))){
      b.enraged=false;b.windup=0;b.boost=0;b.leadTime=0;
      // A sustained narrow lead also counts as a recovered position, even when
      // it never leaves the pass detector's ±4 m anti-jitter band.
      b.confirmedSide=-1;
    }
  }
  const clean=o.collision===0&&o.wallTouch===0,corner=Math.abs(curve)>.0015&&o.speed>18;
  let completedCorner=false;
  if(corner){
    const sign=Math.sign(curve);
    if(!b.inCorner){b.inCorner=true;b.cornerStart=o.s;b.cornerSign=sign;}
    else if(sign!==b.cornerSign&&o.s-b.cornerStart>18){completedCorner=true;b.cornerStart=o.s;b.cornerSign=sign;}
    b.quiet=0;
  }else if(b.inCorner){b.quiet+=dt;if(b.quiet>.18){completedCorner=o.s-b.cornerStart>18;b.inCorner=false;}}
  if(b.id==='shinji-campaign'&&completedCorner&&clean){b.ray=.85;emit('SHINJI / LÍNEA DE LUZ');}
  if(b.id==='takumi-project'){
    const insane=clean&&corner&&Math.abs(curve)>.003&&Math.abs(o.slipAngle)>.12&&o.speed>o.cornerSpeed*.65;
    b.blur+=(Number(insane)-b.blur)*(1-Math.exp(-dt*(insane?8:4)));
  }
  if(b.id==='keisuke-project'){
    const acceleration=(o.speed-b.lastSpeed)/Math.max(.0001,dt);
    b.steady=clean&&corner&&Math.abs(acceleration)<2.5&&o.understeer<.3?b.steady+dt:0;
    if(b.steady>.65&&b.flowCooldown===0){b.flow=2.1;b.flowCooldown=3.8;emit('KEISUKE D / FLUJO ROTATIVO');}
  }
  b.lastSpeed=o.speed;
  if(o.aiDriver){o.aiDriver.counter=b.enraged&&b.boost>0?KANATA_COUNTER:null;}
}

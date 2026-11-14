import {ALL_CARS as CARS,createRace,updateRace,repositionRace,clamp} from './sim.mjs';
import {vehiclePose,resolveVehicleContact} from './traffic.mjs';
import {activateFocus} from './focus.mjs';

export const IDLE_INPUT={steer:0,throttle:false,brake:true,handbrake:false};
export const compactOnlineState=r=>Object.fromEntries(['s','lateral','speed','yaw','yawRate','travelYaw','lateralV','steer','gripUsage','understeer','cornerSpeed','handbrakeDown','handbrakeTime','driftAssist','slipAngle','gear','rpm','elapsed','countdown','headlights','braking','drift','driftPoints','combo','bestCombo','collision','checkpoints','timeLeft','finished','won','blindPasses','blindAward','skill','focus','draft','contactCooldown','resetId','resetHold','resetCooldown','wallTouch','wallContact','wallCooldown','wallSlow'].map(k=>[k,r[k]]));

export function placeOnlineCar(room,other,i,now,focus){
  const r=other.race=createRace(CARS.find(car=>car.id===other.car),room.track,{mode:'time',manual:!!other.manual,build:other.build,night:room.config.night,wet:room.config.wet,...focus});
  r.s=24-Math.floor(i/2)*7;
  r.lateral=i%2?2:-2;
  r.countdown=3;
  r.timeLeft=Math.ceil(room.track.length/20)+90;
  other.input={...IDLE_INPUT};
  other.inputAt=now;
  other.place=null;
  other.dnf=false;
  other.saved=null;
  other.finishTime=null;
  other.sequence=-1;
}

export function onlineAction(p,type){
  if(type==='reposition'){
    if(!repositionRace(p.race))throw Error('Espera a la salida o a que se habilite de nuevo CENTRAR.');
    p.input={...IDLE_INPUT};
  }else if(!activateFocus(p.race))throw Error('Necesitas al menos 30% de concentración y estar fuera de un impacto o recuperación.');
}

export function onlineInput(p,data,now){
  if(!Number.isSafeInteger(data.seq)||data.seq<=p.sequence||typeof data.steer!=='number'||!Number.isFinite(data.steer))return;
  p.sequence=data.seq;p.inputAt=now;p.input={steer:clamp(data.steer,-1,1),throttle:data.throttle===true,brake:data.brake===true,handbrake:data.handbrake===true,gear:Number.isInteger(data.gear)&&data.gear>=1&&data.gear<=5?data.gear:undefined,gearEpoch:data.gearEpoch};
  p.race.headlights=data.headlights!==false;
}

export function onlineSnapshot(room,tick){
  return {type:'snapshot',tick,phase:room.phase,elapsed:room.elapsed,players:[...room.players.values()].map(p=>({id:p.client.id,name:p.name,car:p.car,build:p.build,connected:p.connected,dnf:p.dnf,place:p.place,state:compactOnlineState(p.race)}))};
}

export function stepOnlineRace(room,dt,now,onFinish=()=>{}){
  room.elapsed+=dt;
  const active=[...room.players.values()].filter(p=>!p.dnf&&!p.race.finished);
  const poses=new Map(active.map(p=>[p,vehiclePose(p.race)]));
  for(const p of active){
    const traffic=active.filter(other=>other!==p).map(other=>poses.get(other));
    updateRace(p.race,now-p.inputAt>300?IDLE_INPUT:p.input,dt,traffic);
  }
  // One shared contact model for campaign and multiplayer, including recovery.
  for(let pass=0;pass<3;pass++)for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++)resolveVehicleContact(active[i].race,active[j].race,poses.get(active[i]),poses.get(active[j]));
  const newlyFinished=[];
  for(const p of active)if(p.race.finished){if(p.race.s>=room.track.length)newlyFinished.push({p,fraction:clamp((room.track.length-poses.get(p).s)/Math.max(.00001,p.race.s-poses.get(p).s),0,1)});else p.dnf=true;}
  newlyFinished.sort((a,b)=>a.fraction-b.fraction);
  for(const {p,fraction} of newlyFinished){p.place=room.finishOrder.length+1;p.finishTime=room.elapsed-3-dt*(1-fraction);room.finishOrder.push(p.client.id);if(room.firstFinish===null)room.firstFinish=room.elapsed;
    onFinish(p);
  }
  const players=[...room.players.values()];
  if(players.every(p=>p.race.finished)||room.firstFinish!==null&&room.elapsed-room.firstFinish>45||room.elapsed>room.track.length/15+150){
    for(const p of players)if(!p.place){p.dnf=true;p.race.finished=true;}
    room.phase='results';
    for(const p of players)onFinish(p);
    room.results=players.sort((a,b)=>(a.place??99)-(b.place??99)||b.race.s-a.race.s).map(p=>({id:p.client.id,userId:p.userId,portraitUrl:p.portraitUrl,name:p.name,car:p.car,place:p.place,dnf:p.dnf,connected:p.connected,time:p.place?p.finishTime:null,points:Math.floor(p.race.skill.points)}));
    return true;
  }
  return false;
}

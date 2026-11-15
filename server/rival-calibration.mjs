import {setImmediate} from 'node:timers/promises';
import {createRace,makeTrack,rivalCar,rivalDriverInput,updateRace} from '../js/sim.mjs';
import {PHYSICS_STEP} from '../js/presentation.mjs';

const trackCache=new WeakMap();
const calibrationCache=new WeakMap();
const TOLERANCE=.75;

export function calibrationTrack(config){
  if(!trackCache.has(config))trackCache.set(config,makeTrack(config));
  return trackCache.get(config);
}

export async function sampleRivalTime(track,rival,{wet=false,laps=1,startS=24,lane=1.25}={}){
  const race=createRace(rivalCar(rival),track,{mode:'time',aiDriver:rival,wet,laps});
  Object.assign(race,{s:startS,lateral:lane,countdown:0,timeLeft:800});
  const emptyRoad={rival,finished:true,s:-1000,speed:0,lateral:0};
  for(let i=0;!race.finished;i++){
    const previous=race.s;
    updateRace(race,rivalDriverInput(emptyRoad,race,PHYSICS_STEP),PHYSICS_STEP);
    if(race.s>=race.finishDistance){
      const lastStep=(race.finishDistance-previous)/(race.s-previous);
      return race.elapsed-PHYSICS_STEP*(1-lastStep);
    }
    if(race.elapsed>=800)return Infinity;
    if(i%3600===3599)await setImmediate();
  }
  return Infinity;
}

async function solve(track,rival,conditions){
  const target=rival.targetTimeSec;
  const measure=pace=>sampleRivalTime(track,{...rival,targetPaceFactor:pace},conditions);
  let fast=1,slow=.18;
  const fastest=await measure(fast);
  if(fastest>=target-TOLERANCE)return {targetPaceFactor:fast,estimatedTimeSec:fastest};
  let best={targetPaceFactor:fast,estimatedTimeSec:fastest};
  // Use the measured run as a first guess. Bracket the remaining error with
  // bisection against clean runs through the actual driving controller.
  let pace=Math.max(slow,Math.min(fast,fastest/target));
  for(let iteration=0;iteration<12;iteration++){
    const time=await measure(pace);
    if(Math.abs(time-target)<Math.abs(best.estimatedTimeSec-target))best={targetPaceFactor:pace,estimatedTimeSec:time};
    if(Math.abs(time-target)<=TOLERANCE||pace===slow&&time<target)break;
    if(time>target)slow=pace;
    else fast=pace;
    pace=(slow+fast)/2;
  }
  return best;
}

export function calibrateRival(track,rival,conditions){
  if(rival.targetTimeSec==null)return rival;
  if(!calibrationCache.has(track))calibrationCache.set(track,new Map());
  const cache=calibrationCache.get(track);
  const key=JSON.stringify([rival.style,rival.level,rival.ngplus,rival.targetTimeSec,conditions]);
  if(!cache.has(key)){
    const result=solve(track,rival,conditions).catch(error=>{cache.delete(key);throw error;});
    if(cache.size>=120)cache.delete(cache.keys().next().value);
    cache.set(key,result);
  }
  return cache.get(key).then(result=>{
    const time=result.estimatedTimeSec;
    return {...rival,targetPaceFactor:result.targetPaceFactor,estimatedTimeSec:Number.isFinite(time)?Math.round(time*100)/100:null,
      targetTimeReachable:Number.isFinite(time)&&Math.abs(time-rival.targetTimeSec)<=TOLERANCE};
  });
}

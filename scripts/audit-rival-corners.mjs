import {mkdir,writeFile} from 'node:fs/promises';
import {ALL_TRACKS,CARS,makeTrack,createRace,updateRace,sample} from '../js/sim.mjs';
import {campaignStages,campaignConditions} from '../js/campaign.mjs';

// Real 120 Hz races with a stationary player: no rubber-banding or traffic
// maneuver can disguise a bad solo line. Does not read or write player data.
const tracks=new Map(ALL_TRACKS.map(t=>[t.id,makeTrack(t)])),rows=[];
for(const season of ['dry','rain','ngplus'])for(const rival of campaignStages(season)){
 const race=createRace(CARS[0],tracks.get(rival.track),{rival,...campaignConditions(rival),focusEnabled:false});
 Object.assign(race,{countdown:0,timeLeft:10000});
 let walls=0,switches=0,lastBrake=false,brakingTicks=0;const errors=[];
 for(let tick=0;tick<108000&&!race.finished;tick++){
  const cooldown=race.opponent?.wallCooldown??0;updateRace(race,{},1/120);const o=race.opponent;
  if(o.wallCooldown>cooldown+.1)walls++;
  if(o.braking)brakingTicks++;
  if(o.braking!==lastBrake){switches++;lastBrake=o.braking;}
  if(o.s>100&&Math.abs(sample(o.track,o.s).curve)>.002)errors.push(Math.abs(o.lateral-o.targetLine));
 }
 errors.sort((a,b)=>a-b);
 rows.push({id:rival.id,style:rival.style,level:rival.level,finished:race.rivalFinished,time:race.elapsed,walls,
  maxError:errors.at(-1)??0,p95:errors[Math.floor(errors.length*.95)]??0,
  brakeSeconds:brakingTicks/120,switches,switchesPerSecond:switches/race.elapsed});
}
await mkdir('data',{recursive:true});await writeFile('data/rival-corners-audit.json',JSON.stringify(rows,null,2)+'\n');
console.table(rows.map(r=>({id:r.id,time:r.time.toFixed(2),walls:r.walls,maxError:r.maxError.toFixed(3),p95:r.p95.toFixed(3),switchesPerSecond:r.switchesPerSecond.toFixed(2)})));
console.log(JSON.stringify({races:rows.length,finished:rows.filter(r=>r.finished).length,walls:rows.reduce((n,r)=>n+r.walls,0),maxError:Math.max(...rows.map(r=>r.maxError)),meanP95:rows.reduce((n,r)=>n+r.p95,0)/rows.length,switches:rows.reduce((n,r)=>n+r.switches,0)}));

import {ALL_TRACKS,CARS,createRace,makeTrack,updateRace,rivalCar,rivalDriverInput} from '../js/sim.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import {referenceDrive} from '../tests/helpers/reference-driver.mjs';
const rows=[];
for(const cfg of ALL_TRACKS){
 const track=makeTrack(cfg),row={track:cfg.id,length:track.length};
 for(const style of ['Grip','Complete','Skiller']){
  const rival={id:'bench',car:'rx7',color:'#fff',style,level:3},car=rivalCar(rival),r=createRace(car,track,{mode:'time',aiDriver:rival});r.countdown=0;r.lateral=0;r.timeLeft=1000;
  let impacts=0,braking=0,drifting=0;
  for(let i=0;i<108000&&!r.finished;i++){const before=r.wallCooldown,input=rivalDriverInput({rival,s:-1000,speed:0,lateral:0},r,1/120);updateRace(r,input,1/120);if(r.wallCooldown>before+.1)impacts++;braking+=input.brake?1:0;drifting+=r.drift>.25?1:0;}
  row[style]={time:+r.elapsed.toFixed(2),impacts,braking:+(braking/120).toFixed(1),drift:+(drifting/120).toFixed(1),finished:r.won};
 }
 const p=referenceDrive(cfg,{mode:'time'});row.player={time:+p.race.elapsed.toFixed(2),impacts:p.impacts,won:p.race.won};rows.push(row);
}
await mkdir('data',{recursive:true});await writeFile('data/course-balance-v9.json',JSON.stringify(rows,null,2));
console.log(JSON.stringify(rows,null,2));

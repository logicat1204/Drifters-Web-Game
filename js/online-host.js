import {placeOnlineCar,onlineAction,onlineInput,onlineSnapshot,stepOnlineRace} from './online-race.mjs';
import {PHYSICS_STEP} from './presentation.mjs';

export class OnlineHost {
  constructor(lobby,track,initial,now){
    this.room={...lobby,track,elapsed:0,firstFinish:null,finishOrder:[],players:new Map()};
    this.tick=0;
    this.previous=now;
    this.accumulator=0;
    for(const [i,player] of lobby.players.entries()){
      const p={...player,client:{id:player.id}};
      const state=initial.players.find(entry=>entry.id===player.id).state;
      placeOnlineCar(this.room,p,i,now);
      Object.assign(p.race,structuredClone(state));
      this.room.players.set(p.id,p);
    }
  }

  input(id,data,now){
    const p=this.room.players.get(id);
    if(p&&!p.race.finished)onlineInput(p,data,now);
  }

  action(id,type){
    const p=this.room.players.get(id);
    if(p&&!p.race.finished)onlineAction(p,type);
  }

  step(now){
    this.accumulator+=Math.min(.25,Math.max(0,(now-this.previous)/1000));
    this.previous=now;
    let snapshot=null;
    while(this.accumulator>=PHYSICS_STEP&&this.room.phase==='racing'){
      this.accumulator-=PHYSICS_STEP;
      this.tick++;
      const done=stepOnlineRace(this.room,PHYSICS_STEP,now);
      if(done||this.tick%6===0)snapshot=onlineSnapshot(this.room,this.tick);
    }
    return snapshot;
  }
}

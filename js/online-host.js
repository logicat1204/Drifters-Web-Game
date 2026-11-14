import {placeOnlineCar,onlineAction,onlineInput,onlineSnapshot,stepOnlineRace} from './online-race.mjs';
import {PHYSICS_STEP} from './presentation.mjs';

export class OnlineHost {
  constructor(lobby,track,initial,now){
    this.room={...lobby,track,elapsed:0,firstFinish:null,finishOrder:[],players:new Map()};
    this.tick=0;
    this.previous=now;
    this.accumulator=0;
    this.commands=[];
    this.frames=[];
    this.tracedTicks=0;
    for(const [i,player] of lobby.players.entries()){
      const p={...player,slot:i,client:{id:player.id}};
      const state=initial.players.find(entry=>entry.id===player.id).state;
      placeOnlineCar(this.room,p,i,now);
      Object.assign(p.race,structuredClone(state));
      this.room.players.set(p.id,p);
    }
  }

  input(id,data,now){
    const p=this.room.players.get(id);
    if(p&&!p.race.finished&&onlineInput(p,data,now)&&this.room.verify)this.commands.push([p.slot,data.seq]);
  }

  action(id,type,seq){
    const p=this.room.players.get(id);
    if(p&&!p.race.finished){
      onlineAction(p,type);
      if(this.room.verify)this.commands.push([p.slot,seq]);
    }
  }

  trace(){
    const frames=this.frames;
    this.frames=[];
    const from=this.tracedTicks;
    this.tracedTicks=this.tick;
    return {from,frames};
  }

  step(now){
    this.accumulator+=Math.min(.25,Math.max(0,(now-this.previous)/1000));
    this.previous=now;
    let snapshot=null;
    while(this.accumulator>=PHYSICS_STEP&&this.room.phase==='racing'){
      this.accumulator-=PHYSICS_STEP;
      this.tick++;
      let idle=null;
      if(this.room.verify){
        idle=0;
        for(const player of this.room.players.values())if(now-player.inputAt>300)idle|=1<<player.slot;
        const previous=this.frames.at(-1);
        if(!this.commands.length&&previous?.[1]===idle&&previous.length===2)previous[0]++;
        else this.frames.push([1,idle,...this.commands]);
        this.commands=[];
      }
      const done=stepOnlineRace(this.room,PHYSICS_STEP,now,undefined,idle);
      if(done||this.tick%6===0)snapshot=onlineSnapshot(this.room,this.tick);
    }
    return snapshot;
  }
}

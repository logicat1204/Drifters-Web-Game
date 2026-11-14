import {setImmediate} from 'node:timers/promises';
import {onlineAction,onlineInput,placeOnlineCar,stepOnlineRace} from '../js/online-race.mjs';
import {PHYSICS_STEP} from '../js/presentation.mjs';

function invalid(){return Error('Los controles y el resultado de la carrera no coinciden.');}

export class RaceVerification {
  constructor(room,now){
    this.started=now;
    this.limit=Math.ceil((room.track.length/15+155)/PHYSICS_STEP);
    this.frames=[];
    this.ticks=0;
    this.ids=[...room.players.keys()];
    this.inputs=this.ids.map(()=>new Map());
    this.base={track:room.track,config:room.config,introSeconds:room.introSeconds,elapsed:0,firstFinish:null,finishOrder:[],phase:'racing',players:new Map()};
    for(const [slot,original] of [...room.players.values()].entries()){
      const player={...original,slot};
      placeOnlineCar(this.base,player,slot,now,{focusType:original.race.focus.type,focusEnabled:original.race.focus.enabled});
      this.base.players.set(player.client.id,player);
    }
  }
  input(id,data,now){
    const commands=this.inputs[this.ids.indexOf(id)],seq=data.seq;
    if(!commands||!Number.isSafeInteger(seq)||seq<1||commands.has(seq)||commands.size>this.limit/2)return;
    if(data.command==='input'&&Number.isFinite(data.steer)&&Math.abs(data.steer)<=1){
      const {steer,throttle,brake,handbrake,gear,gearEpoch,headlights}=data;
      commands.set(seq,{command:'input',seq,steer,throttle:throttle===true,brake:brake===true,handbrake:handbrake===true,
        gear:Number.isInteger(gear)&&gear>=1&&gear<=5?gear:undefined,gearEpoch:Number.isSafeInteger(gearEpoch)?gearEpoch:undefined,headlights:headlights!==false,at:now});
    }else if(['focus','reposition'].includes(data.command))commands.set(seq,{command:data.command,at:now});
  }
  trace(from,frames,now){
    if(this.invalid)return;
    if(from!==this.ticks||!Array.isArray(frames)||!frames.length||frames.length>80){this.invalid=true;return;}
    for(const frame of frames){
      if(!Array.isArray(frame)||frame.length<2||frame.length>32){this.invalid=true;return;}
      const [count,mask,...commands]=frame;
      if(!Number.isInteger(count)||count<1||count>120||!Number.isInteger(mask)||mask<0||mask>=1<<this.ids.length||
        commands.length&&count!==1||commands.some(cmd=>!Array.isArray(cmd)||cmd.length!==2||!Number.isInteger(cmd[0])||cmd[0]<0||cmd[0]>=this.ids.length||!Number.isSafeInteger(cmd[1]))){this.invalid=true;return;}
      this.ticks+=count;
      if(this.ticks>this.limit||this.ticks*PHYSICS_STEP*1000>now-this.started+2200){this.invalid=true;return;}
      this.frames.push({frame,at:now});
    }
  }
  async replay(reported,now){
    if(this.invalid||!this.frames.length||!Array.isArray(reported)||reported.length!==this.ids.length||now-this.started+2200<this.ticks*PHYSICS_STEP*1000)throw invalid();
    const players=[...this.base.players.values()],used=players.map(()=>new Set()),lastInput=players.map(()=>null);
    let tick=0;
    for(const {frame,at} of this.frames){
      const [count,mask,...commands]=frame;
      const simTime=this.started+tick*PHYSICS_STEP*1000;
      for(const [slot,seq] of commands){
        const entry=this.inputs[slot].get(seq),player=players[slot];
        if(!entry||used[slot].has(seq)||player.race.finished||entry.at>at+1500||entry.at<simTime-8000)throw invalid();
        used[slot].add(seq);
        if(entry.command==='input'){
          if(!onlineInput(player,entry,simTime))throw invalid();
          lastInput[slot]=tick;
        }else onlineAction(player,entry.command);
      }
      for(let j=0;j<count;j++){
        if(this.base.phase!=='racing')throw invalid();
        for(const [slot,player] of players.entries()){
          if(player.race.finished||player.dnf)continue;
          if(lastInput[slot]===null)continue;
          const age=tick+j-lastInput[slot];
          const idle=(mask&(1<<slot))!==0;
          // Allow a stalled browser to catch up, while requiring fresh controls for a live participant.
          if(!idle&&age>168||idle&&age<12)throw invalid();
        }
        stepOnlineRace(this.base,PHYSICS_STEP,0,undefined,mask);
        if((tick+j)%2500===0)await setImmediate();
      }
      tick+=count;
    }
    for(const [slot,records] of this.inputs.entries()){
      let expected=0,accepted=0;
      for(const [seq,entry] of records){
        if(entry.command!=='input'||entry.at<this.frames[0].at||entry.at>this.frames.at(-1).at-1000)continue;
        expected++;
        if(used[slot].has(seq))accepted++;
      }
      if(expected>=60&&accepted/expected<.65)throw invalid();
    }
    if(this.base.phase!=='results'||!this.base.results.every(result=>reported.some(row=>
      row?.id===result.id&&row.place===result.place&&(result.dnf?row.time===null:Number.isFinite(row.time)&&Math.abs(row.time-result.time)<.02))))throw invalid();
    return {results:this.base.results,players,evidence:{controls:this.inputs.map((input,slot)=>[...input].filter(([seq])=>used[slot].has(seq))),frames:this.frames.map(({frame})=>frame)}};
  }
}

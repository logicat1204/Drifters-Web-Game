const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function createSkillState(){return {intensity:0,points:0,chain:0,level:0,corner:false,quiet:0,peak:0,clean:true,cornerPoints:0,award:null,awardId:0,flash:0};}
export function cornerQuality({curve,speed,grip,lateral,slipAngle=0,travelYaw=0,collision=0}){
  const bend=Math.abs(curve);if(bend<.0012||speed<15||collision>0||Math.abs(lateral)>3.8||Math.abs(slipAngle)>.52||Math.abs(travelYaw)>.4)return 0;
  const limit=Math.sqrt(grip/Math.max(.00001,bend)),ratio=speed/limit;
  if(ratio>1.06)return 0;
  const pace=clamp((ratio-.48)/.43,0,1),clean=clamp(1-Math.max(0,Math.abs(lateral)-2.7)*.35,0,1);
  return pace*clean*clamp(bend/.003,0,1);
}
export function updateCornerSkill(r,dt,curve,grip){
  const s=r.skill,quality=cornerQuality({curve,speed:r.speed,grip,lateral:r.lateral,slipAngle:r.slipAngle,travelYaw:r.travelYaw,collision:r.collision});
  s.intensity+=(quality-s.intensity)*(1-Math.exp(-dt*(quality>0?5:9)));
  s.level=s.intensity>.76?3:s.intensity>.43?2:s.intensity>.15?1:0;s.flash=Math.max(0,s.flash-dt*2.5);
  if(Math.abs(curve)>.0015&&r.speed>12){if(!s.corner){s.corner=true;s.clean=true;s.peak=0;s.cornerPoints=0;}s.quiet=0;s.peak=Math.max(s.peak,s.intensity);if(r.collision>0||Math.abs(r.lateral)>4.1)s.clean=false;
    const earned=dt*r.speed*quality*(5+Math.min(s.chain,5));s.cornerPoints+=earned;s.points+=earned;
  }else if(s.corner){s.quiet+=dt;if(s.quiet>.35){
    if(s.clean&&s.peak>.2&&s.cornerPoints>20){s.chain++;s.award={grade:s.peak>.76?'PERFECT APEX':s.peak>.43?'GREAT LINE':'CLEAN CORNER',points:Math.round(s.cornerPoints),chain:s.chain};s.awardId++;s.flash=s.peak>.76?1:.5;}
    else s.chain=0;s.corner=false;
  }}
  if(r.collision>.1){s.chain=0;s.clean=false;s.intensity*=Math.exp(-dt*15);}
}

// Visual state only. Never feeds steering, collision, replay or server physics.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,dt,hz)=>a+(b-a)*(1-Math.exp(-dt*hz));
export class DriverCamera {
 reset(r){this.race=r;this.epoch=r?.resetId;this.speed=r?.speed||0;this.gear=r?.gear;this.pose={x:0,y:0,z:0,yaw:0,pitch:0,roll:0,steer:r?.steer||0,shift:0,kick:0,handbrake:0};return this.pose;}
 update(r,dt,options={}){
  if(!this.pose||this.race!==r||this.epoch!==r.resetId||options.reset)this.reset(r);
  dt=clamp(Number(dt)||0,0,.05);const p=this.pose,amount=options.reducedMotion||options.shake===false?0:clamp((Number.isFinite(Number(options.motion))?Number(options.motion):65)/100,0,1),active=options.active!==false&&r.countdown<=0&&!r.finished;
  const speed=Math.max(0,r.speed||0),accel=active&&dt>0?clamp((speed-this.speed)/dt,-22,16):0;this.speed=speed;
  if(this.gear!==r.gear){if(active)p.shift=1;this.gear=r.gear;}p.shift=Math.max(0,p.shift-dt*4.5);
  const slip=clamp(r.travelYaw??r.yaw??0,-.6,.6),lateral=clamp((r.steer||0)*speed/65,-1,1),rough=active?Math.sin((r.s||0)*1.9)*Math.min(speed/60,1)*.002:0;
  p.x=smooth(p.x,lateral*.022*amount,dt,9);p.y=smooth(p.y,(rough-Math.abs(lateral)*.005)*amount,dt,12);p.z=smooth(p.z,accel*.0023*amount,dt,8);
  p.yaw=smooth(p.yaw,clamp(-slip*.22,-.11,.11)*amount,dt,7);p.pitch=smooth(p.pitch,(-accel*.0016+p.shift*.009)*amount,dt,9);
  p.roll=smooth(p.roll,options.stableHorizon!==false?0:-lateral*.021*amount,dt,8);p.steer=smooth(p.steer,clamp(r.steer||0,-1,1),dt,19);
  p.kick=smooth(p.kick,clamp(r.collision||0,0,1)*.012*amount,dt,18);p.handbrake=smooth(p.handbrake,r.handbrakeDown?1:0,dt,20);return p;
 }
}

import {focusType} from './focus.mjs';
function makeDrop() {
  const canvas=document.createElement('canvas');
  canvas.width=24;canvas.height=36;
  const context=canvas.getContext('2d');
  context.fillStyle='#142a3d';
  context.beginPath();context.ellipse(12,18,8,14,-.32,0,Math.PI*2);context.fill();
  context.strokeStyle='#c9e6f7';context.lineWidth=1.7;
  context.beginPath();context.ellipse(10.5,15,5.2,8,-.32,Math.PI*.87,Math.PI*1.8);context.stroke();
  return canvas;
}
export class CornerEffects {
  constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.time=0;this.reduced=window.matchMedia('(prefers-reduced-motion: reduce)');}
  drawRain(c,r,w,h,cabin,time,mirror){
    const speed=Math.min(1,r.speed/64),scale=Math.max(.65,Math.min(1.45,w/850));
    const falling=this.reduced.matches?0:time;
    c.save();
    if(cabin){
      c.beginPath();
      c.moveTo(w*.23,h*.18);c.lineTo(w*.78,h*.18);
      c.lineTo(w*.88,h*.61);c.lineTo(w*.12,h*.61);c.closePath();
      c.clip();
      if(mirror){
        c.beginPath();c.rect(0,0,w,h);c.rect(mirror.x,mirror.y,mirror.width,mirror.height);
        c.clip('evenodd');
      }
    }
    // Fine distant rainfall and a sparser layer of near, faster drops.
    for(const layer of [0,1]){
      c.strokeStyle=layer?'#c5e2f258':'#adcae638';
      c.lineWidth=(layer?1.15:.65)*scale;
      c.beginPath();
      const count=layer?27:62;
      for(let i=0;i<count;i++){
        const seed=((i+1)*.6180339887+layer*.23)%1;
        const y=((i*.2773+falling*(layer?1.62:.92)*(1+seed*.31))%1)*h;
        const x=((seed+falling*(layer?.063:.032))%1)*w;
        const length=(layer?24:11)*scale*(.72+seed*.55+speed*.8);
        c.moveTo(x,y);
        c.lineTo(x-length*(.20+speed*.18),y+length);
      }
      c.stroke();
    }
    if(cabin){
      this.drop??=makeDrop();
      const sweep=.5+Math.sin(time*3.8)*.31;
      c.beginPath();
      for(let i=0;i<42;i++){
        const seed=(i*.61803399)%1,life=(falling*(.28+seed*.23)+i*.371)%1;
        const x=(.16+(i*.32767%1)*.68+life*speed*.022)*w;
        const y=(.18+seed*.38+life*(.032+speed*.035))*h;
        const cleared=Math.abs(x/w-sweep)<.073&&y/h>.29;
        const size=(.9+(i*.2345%1)*2.3)*scale;
        c.globalAlpha=Math.min(1,life*5,(1-life)*7)*(cleared?.12:.82);
        c.drawImage(this.drop,x-size*1.5,y-size*2.25,size*3,size*4.5);
        if(!cleared&&speed>.32&&i%5===0){c.moveTo(x,y);c.lineTo(x-size*1.5,y-size*(4+speed*5));}
      }
      c.globalAlpha=1;c.strokeStyle='#bad9ee36';c.lineWidth=.65*scale;c.stroke();
    }
    c.restore();
  }
  draw(r,visible,dt,motion=true,cabin=false,weatherTime=this.time,mirror=null){
    const canvas=this.canvas;canvas.classList.toggle('hidden',!visible);if(!visible||!r)return;
    const w=canvas.clientWidth,h=canvas.clientHeight;
    const dpr=Math.min(window.devicePixelRatio||1,1.5,r.wet?Math.sqrt(900000/Math.max(1,w*h)):1.5);
    if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
    const c=this.ctx;c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);this.time+=dt;
    const focused=r.focus?.remaining>0,theme=focusType(r),power=Math.max(r.skill.intensity,focused?.9:0);
    if(r.wet)this.drawRain(c,r,w,h,cabin,weatherTime,mirror);
    if(power<.025||this.reduced.matches||!motion)return;
    // Keep the vanishing point and braking references unobstructed; no flashes.
    const glow=c.createRadialGradient(w*.5,h*.43,w*.27,w*.5,h*.43,w*.72);
    glow.addColorStop(0,'#3855c000');glow.addColorStop(.55,focused?theme.aura+'28':`rgba(82,95,225,${power*.16})`);glow.addColorStop(1,focused?theme.aura+'70':`rgba(95,161,245,${power*.36})`);c.fillStyle=glow;c.fillRect(0,0,w,h);
    c.save();c.globalCompositeOperation='screen';
    for(let i=0;i<36;i++){
      const a=i*2.39996,phase=(this.time*(.65+power)+i*.173)%1,rad=.32+phase*.30;
      const x=w*.5+Math.cos(a)*w*rad,y=h*.43+Math.sin(a)*h*rad;
      if(x>w*.20&&x<w*.80&&y>h*.12&&y<h*.80)continue;
      c.strokeStyle=focused?(i%3?theme.color:theme.aura):i%3?'#7ee0ff':'#b795ff';c.globalAlpha=power*(1-phase)*.65;c.lineWidth=(1+power)*Math.min(1.5,w/1000);c.beginPath();c.moveTo(x,y);c.lineTo(x+Math.cos(a)*w*(.02+power*.045),y+Math.sin(a)*h*(.02+power*.045));c.stroke();
    }
    if(focused&&theme.id==='drift'){
      c.globalAlpha=.40;c.strokeStyle=theme.color;c.fillStyle=theme.aura+'20';c.lineWidth=1.5;
      for(const side of [-1,1])for(let feather=0;feather<6;feather++){
        const rootX=w*.5+side*w*.06,rootY=h*.76,tipX=w*.5+side*w*(.19+feather*.023),tipY=h*(.57+feather*.025)+Math.sin(this.time*2)*h*.007;
        c.beginPath();c.moveTo(rootX,rootY);c.quadraticCurveTo(w*.5+side*w*.22,h*.73,tipX,tipY);c.quadraticCurveTo(w*.5+side*w*.13,h*.77,rootX,rootY);c.fill();c.stroke();
      }
    }
    c.restore();
  }
}
